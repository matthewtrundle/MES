'use server';

import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/rbac';

export interface BuildableMaterial {
  materialCode: string;
  description: string | null;
  qtyPerUnit: number;
  availableQty: number;
  buildableFromThis: number;
  isBottleneck: boolean;
}

export interface BuildableUnitsResult {
  routingId: string;
  routingName: string;
  productCode: string;
  buildableUnits: number;
  limitingMaterial: BuildableMaterial | null;
  materials: BuildableMaterial[];
}

/**
 * Calculate buildable units for a single routing/product.
 * Looks up BOM requirements and checks available (unreserved) inventory.
 */
export async function getBuildableUnitsForRouting(
  routingId: string
): Promise<BuildableUnitsResult | null> {
  await requireRole(['admin', 'supervisor']);

  const routing = await prisma.routing.findUnique({
    where: { id: routingId },
    include: {
      bom: {
        where: { active: true },
      },
    },
  });

  if (!routing) return null;
  if (routing.bom.length === 0) {
    return {
      routingId: routing.id,
      routingName: routing.name,
      productCode: routing.productCode,
      buildableUnits: 0,
      limitingMaterial: null,
      materials: [],
    };
  }

  // Get unique material codes from BOM
  // Aggregate qtyPerUnit across all stations for each material code
  const bomByMaterial: Record<string, { qtyPerUnit: number; description: string | null }> = {};
  for (const item of routing.bom) {
    if (!bomByMaterial[item.materialCode]) {
      bomByMaterial[item.materialCode] = {
        qtyPerUnit: 0,
        description: item.description,
      };
    }
    bomByMaterial[item.materialCode].qtyPerUnit += item.qtyPerUnit;
  }

  const materialCodes = Object.keys(bomByMaterial);

  // Get available inventory per material code (on-hand minus committed in kits)
  const onHand = await prisma.materialLot.groupBy({
    by: ['materialCode'],
    where: {
      materialCode: { in: materialCodes },
      status: 'available',
      qtyRemaining: { gt: 0 },
    },
    _sum: { qtyRemaining: true },
  });

  const onHandMap: Record<string, number> = {};
  for (const entry of onHand) {
    onHandMap[entry.materialCode] = entry._sum.qtyRemaining ?? 0;
  }

  // Get committed quantities (in non-issued kits)
  const kitLines = await prisma.kitLine.findMany({
    where: {
      materialCode: { in: materialCodes },
      kit: { status: { in: ['pending', 'in_progress', 'complete'] } },
      qtyPicked: { gt: 0 },
    },
    select: {
      materialCode: true,
      qtyPicked: true,
    },
  });

  const committedMap: Record<string, number> = {};
  for (const line of kitLines) {
    committedMap[line.materialCode] = (committedMap[line.materialCode] ?? 0) + line.qtyPicked;
  }

  // Calculate buildable units per material
  const materials: BuildableMaterial[] = materialCodes.map((code) => {
    const totalOnHand = onHandMap[code] ?? 0;
    const committed = committedMap[code] ?? 0;
    const available = Math.max(0, totalOnHand - committed);
    const qtyPerUnit = bomByMaterial[code].qtyPerUnit;
    const buildable = qtyPerUnit > 0 ? Math.floor(available / qtyPerUnit) : 0;

    return {
      materialCode: code,
      description: bomByMaterial[code].description,
      qtyPerUnit,
      availableQty: available,
      buildableFromThis: buildable,
      isBottleneck: false,
    };
  });

  // Buildable units = min across all materials
  const buildableUnits = materials.length > 0
    ? Math.min(...materials.map((m) => m.buildableFromThis))
    : 0;

  // Mark bottleneck(s)
  let limitingMaterial: BuildableMaterial | null = null;
  for (const mat of materials) {
    if (mat.buildableFromThis === buildableUnits) {
      mat.isBottleneck = true;
      if (!limitingMaterial) {
        limitingMaterial = mat;
      }
    }
  }

  return {
    routingId: routing.id,
    routingName: routing.name,
    productCode: routing.productCode,
    buildableUnits,
    limitingMaterial,
    materials,
  };
}

/**
 * Calculate buildable units for all active routings/products.
 */
export async function getBuildableUnits(): Promise<BuildableUnitsResult[]> {
  await requireRole(['admin', 'supervisor']);

  const routings = await prisma.routing.findMany({
    where: { active: true },
    select: { id: true },
  });

  const results: BuildableUnitsResult[] = [];

  for (const routing of routings) {
    const result = await getBuildableUnitsForRouting(routing.id);
    if (result) {
      results.push(result);
    }
  }

  // Sort by product code
  results.sort((a, b) => a.productCode.localeCompare(b.productCode));

  return results;
}
