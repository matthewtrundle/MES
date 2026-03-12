'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ExportButton, type ExportType } from '@/components/admin/ExportButton';
import {
  ClipboardList,
  Cpu,
  AlertTriangle,
  Package,
  Truck,
  Activity,
  CheckCircle,
} from 'lucide-react';

interface ExportCardDef {
  type: ExportType;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const EXPORT_CARDS: ExportCardDef[] = [
  {
    type: 'work-orders',
    title: 'Work Orders',
    description: 'Order number, product, status, quantities, customer, due date, and creation date.',
    icon: <ClipboardList className="h-5 w-5 text-blue-600" />,
  },
  {
    type: 'units',
    title: 'Units',
    description: 'Serial number, associated work order, status, current station, and creation date.',
    icon: <Cpu className="h-5 w-5 text-indigo-600" />,
  },
  {
    type: 'ncrs',
    title: 'Nonconformance Records',
    description: 'NCR number, defect type, disposition, status, source, and creation date.',
    icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
  },
  {
    type: 'inventory',
    title: 'Inventory (Material Lots)',
    description: 'Lot number, material code, quantities received/remaining, status, supplier, and received date.',
    icon: <Package className="h-5 w-5 text-emerald-600" />,
  },
  {
    type: 'shipments',
    title: 'Shipments',
    description: 'Shipped work orders with order number, customer, product, quantity, and ship date.',
    icon: <Truck className="h-5 w-5 text-purple-600" />,
  },
  {
    type: 'production-history',
    title: 'Production History',
    description: 'Unit operation executions: serial, station, operator, start/end times, cycle time, and result.',
    icon: <Activity className="h-5 w-5 text-rose-600" />,
  },
  {
    type: 'quality-checks',
    title: 'Quality Checks',
    description: 'Quality check results: serial, check name/type, result, operator, and timestamp.',
    icon: <CheckCircle className="h-5 w-5 text-teal-600" />,
  },
];

export function ExportDashboard() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filters: Record<string, string> = {};
  if (dateFrom) filters.dateFrom = dateFrom;
  if (dateTo) filters.dateTo = dateTo;

  return (
    <div className="space-y-6">
      {/* Date range filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Date Range Filter</CardTitle>
          <CardDescription>
            Optionally filter all exports by date range. Leave empty to export all records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="dateFrom">From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dateTo">To</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-44"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="text-sm text-slate-500 hover:text-slate-700 underline pb-2"
              >
                Clear
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Export cards grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {EXPORT_CARDS.map(card => (
          <Card key={card.type}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                {card.icon}
                <CardTitle className="text-base">{card.title}</CardTitle>
              </div>
              <CardDescription className="text-xs">
                {card.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExportButton
                type={card.type}
                filters={Object.keys(filters).length > 0 ? filters : undefined}
                label={`Export ${card.title}`}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
