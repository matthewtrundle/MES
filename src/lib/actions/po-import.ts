'use server';

import { requireRole } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db/prisma';
import { emitEvent, generateUniqueIdempotencyKey } from '@/lib/db/events';
import { logAuditTrail } from '@/lib/db/audit';
import { getNextPoNumber } from '@/lib/actions/purchase-orders';
import { parseCSV } from '@/lib/utils/csv';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ── CSV row validation schema ─────────────────────────────────────
const csvRowSchema = z.object({
  supplier_id: z.string().uuid({ message: 'Must be a valid UUID' }),
  buyer_name: z.string().min(1, { message: 'Buyer name is required' }),
  order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Must be YYYY-MM-DD format',
  }),
  expected_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Must be YYYY-MM-DD format' })
    .optional()
    .or(z.literal('')),
  currency: z.string().max(10).optional().or(z.literal('')),
  payment_terms: z.string().max(100).optional().or(z.literal('')),
  shipping_method: z.string().max(100).optional().or(z.literal('')),
  line_part_number: z.string().min(1, { message: 'Part number is required' }),
  line_description: z.string().max(500).optional().or(z.literal('')),
  line_qty: z.string().min(1, { message: 'Quantity is required' }),
  line_unit_of_measure: z.string().max(20).optional().or(z.literal('')),
  line_unit_cost: z.string().optional().or(z.literal('')),
  line_country_of_origin: z.string().max(5).optional().or(z.literal('')),
  line_lead_time_days: z.string().optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
});

type ImportResult = {
  created: number;
  errors: Array<{ row: number; message: string }>;
};

// ── Import Purchase Orders from CSV ───────────────────────────────
export async function importPurchaseOrdersFromCSV(
  csvContent: string
): Promise<ImportResult> {
  const user = await requireRole(['admin', 'supervisor']);

  const rows = parseCSV(csvContent);

  if (rows.length === 0) {
    return { created: 0, errors: [{ row: 0, message: 'CSV file is empty or has no data rows' }] };
  }

  // ── Phase 1: Validate all rows ──────────────────────────────────
  const errors: Array<{ row: number; message: string }> = [];
  const validatedRows: Array<{
    rowIndex: number;
    data: z.infer<typeof csvRowSchema>;
    qty: number;
    unitCost: number | undefined;
    leadTimeDays: number | undefined;
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // +2 because row 1 is headers, data starts at row 2
    const row = rows[i];

    const result = csvRowSchema.safeParse(row);
    if (!result.success) {
      const messages = result.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`
      );
      errors.push({ row: rowNum, message: messages.join('; ') });
      continue;
    }

    const data = result.data;

    // Validate numeric fields
    const qty = parseInt(data.line_qty, 10);
    if (isNaN(qty) || qty < 1) {
      errors.push({ row: rowNum, message: 'line_qty must be a positive integer' });
      continue;
    }

    let unitCost: number | undefined;
    if (data.line_unit_cost && data.line_unit_cost !== '') {
      unitCost = parseFloat(data.line_unit_cost);
      if (isNaN(unitCost) || unitCost < 0) {
        errors.push({ row: rowNum, message: 'line_unit_cost must be a non-negative number' });
        continue;
      }
    }

    let leadTimeDays: number | undefined;
    if (data.line_lead_time_days && data.line_lead_time_days !== '') {
      leadTimeDays = parseInt(data.line_lead_time_days, 10);
      if (isNaN(leadTimeDays) || leadTimeDays < 0) {
        errors.push({ row: rowNum, message: 'line_lead_time_days must be a non-negative integer' });
        continue;
      }
    }

    // Validate order_date is a real date
    const orderDate = new Date(data.order_date);
    if (isNaN(orderDate.getTime())) {
      errors.push({ row: rowNum, message: 'order_date is not a valid date' });
      continue;
    }

    // Validate expected_date if present
    if (data.expected_date && data.expected_date !== '') {
      const expectedDate = new Date(data.expected_date);
      if (isNaN(expectedDate.getTime())) {
        errors.push({ row: rowNum, message: 'expected_date is not a valid date' });
        continue;
      }
    }

    validatedRows.push({ rowIndex: i, data, qty, unitCost, leadTimeDays });
  }

  // Fail fast if any validation errors
  if (errors.length > 0) {
    return { created: 0, errors };
  }

  // ── Phase 2: Validate supplier IDs exist ─────────────────────────
  const supplierIds = [...new Set(validatedRows.map((r) => r.data.supplier_id))];
  const existingSuppliers = await prisma.supplier.findMany({
    where: { id: { in: supplierIds } },
    select: { id: true },
  });
  const existingSupplierIds = new Set(existingSuppliers.map((s) => s.id));

  for (const row of validatedRows) {
    if (!existingSupplierIds.has(row.data.supplier_id)) {
      errors.push({
        row: row.rowIndex + 2,
        message: `Supplier with ID "${row.data.supplier_id}" not found`,
      });
    }
  }

  if (errors.length > 0) {
    return { created: 0, errors };
  }

  // ── Phase 3: Group rows into POs ─────────────────────────────────
  const poGroups = new Map<
    string,
    {
      supplierId: string;
      buyerName: string;
      orderDate: string;
      expectedDate?: string;
      currency: string;
      paymentTerms?: string;
      shippingMethod?: string;
      notes?: string;
      lines: Array<{
        partNumber: string;
        description?: string;
        qty: number;
        unitOfMeasure: string;
        unitCost?: number;
        countryOfOrigin?: string;
        leadTimeDays?: number;
      }>;
    }
  >();

  for (const row of validatedRows) {
    const { data, qty, unitCost, leadTimeDays } = row;
    const groupKey = `${data.supplier_id}|${data.order_date}|${data.buyer_name}`;

    if (!poGroups.has(groupKey)) {
      poGroups.set(groupKey, {
        supplierId: data.supplier_id,
        buyerName: data.buyer_name,
        orderDate: data.order_date,
        expectedDate: data.expected_date || undefined,
        currency: data.currency || 'USD',
        paymentTerms: data.payment_terms || undefined,
        shippingMethod: data.shipping_method || undefined,
        notes: data.notes || undefined,
        lines: [],
      });
    }

    const group = poGroups.get(groupKey)!;
    group.lines.push({
      partNumber: data.line_part_number,
      description: data.line_description || undefined,
      qty,
      unitOfMeasure: data.line_unit_of_measure || 'EA',
      unitCost,
      countryOfOrigin: data.line_country_of_origin || undefined,
      leadTimeDays,
    });
  }

  // ── Phase 4: Create POs in transaction ───────────────────────────
  let createdCount = 0;
  const createdPoIds: string[] = [];

  for (const group of poGroups.values()) {
    const totalValue = group.lines.reduce((sum, line) => {
      return sum + (line.unitCost ?? 0) * line.qty;
    }, 0);

    const po = await prisma.$transaction(async (tx) => {
      const poNumber = await getNextPoNumber(tx);
      return tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: group.supplierId,
          buyerName: group.buyerName,
          orderDate: new Date(group.orderDate),
          expectedDate: group.expectedDate ? new Date(group.expectedDate) : null,
          status: 'draft',
          currency: group.currency,
          paymentTerms: group.paymentTerms ?? null,
          shippingMethod: group.shippingMethod ?? null,
          totalValue,
          notes: group.notes ?? null,
          lineItems: {
            create: group.lines.map((line, idx) => ({
              lineNumber: idx + 1,
              partNumber: line.partNumber,
              partRevision: 'A',
              description: line.description ?? null,
              qtyOrdered: line.qty,
              qtyReceived: 0,
              unitOfMeasure: line.unitOfMeasure,
              unitCost: line.unitCost ?? null,
              totalCost: line.unitCost != null ? line.unitCost * line.qty : null,
              countryOfOrigin: line.countryOfOrigin ?? null,
              expectedLeadTimeDays: line.leadTimeDays ?? null,
            })),
          },
        },
        include: { lineItems: true },
      });
    });

    createdPoIds.push(po.id);
    createdCount++;

    await logAuditTrail(user.id, 'create', 'PurchaseOrder', po.id, null, {
      poNumber: po.poNumber,
      supplierId: group.supplierId,
      lineItemCount: group.lines.length,
      totalValue,
      importSource: 'csv',
    });

    const siteId = user.sites[0]?.id;
    if (siteId) {
      await emitEvent({
        eventType: 'purchase_order_created',
        siteId,
        operatorId: user.id,
        payload: {
          action: 'purchase_order_imported_csv',
          purchaseOrderId: po.id,
          poNumber: po.poNumber,
          supplierId: group.supplierId,
          totalValue,
          lineItemCount: group.lines.length,
        },
        source: 'ui',
        idempotencyKey: generateUniqueIdempotencyKey(),
      });
    }
  }

  revalidatePath('/admin/purchase-orders');
  return { created: createdCount, errors: [] };
}

// ── Generate CSV Template ─────────────────────────────────────────
export async function generatePOImportTemplate(): Promise<string> {
  await requireRole(['admin', 'supervisor']);

  const headers = [
    'supplier_id',
    'buyer_name',
    'order_date',
    'expected_date',
    'currency',
    'payment_terms',
    'shipping_method',
    'line_part_number',
    'line_description',
    'line_qty',
    'line_unit_of_measure',
    'line_unit_cost',
    'line_country_of_origin',
    'line_lead_time_days',
    'notes',
  ];

  const exampleRows = [
    [
      '00000000-0000-0000-0000-000000000001',
      'Jane Smith',
      '2026-03-15',
      '2026-04-15',
      'USD',
      'Net 30',
      'Ground',
      'MTR-001',
      'Motor Assembly Kit',
      '100',
      'EA',
      '25.50',
      'US',
      '14',
      'Urgent order',
    ],
    [
      '00000000-0000-0000-0000-000000000001',
      'Jane Smith',
      '2026-03-15',
      '2026-04-15',
      'USD',
      'Net 30',
      'Ground',
      'BRG-002',
      'Bearing Set',
      '200',
      'EA',
      '12.75',
      'DE',
      '21',
      '',
    ],
  ];

  const lines = [
    headers.join(','),
    ...exampleRows.map((row) => row.join(',')),
  ];

  return lines.join('\n');
}
