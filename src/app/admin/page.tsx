import { prisma } from '@/lib/db/prisma';
import Link from 'next/link';
import {
  Factory,
  ClipboardCheck,
  Clock,
  ListOrdered,
  FileText,
  ShieldCheck,
  Target,
  TestTube2,
  ClipboardList,
  Package,
  Truck,
  ShoppingCart,
  PackageOpen,
  Boxes,
  Send,
  Users,
  ScrollText,
  Key,
  Webhook,
  Download,
  BookOpen,
  ChevronRight,
  Activity,
} from 'lucide-react';

async function getAdminStats() {
  const [
    stationCount,
    activeWorkOrders,
    totalUnits,
    openNCRs,
    supplierCount,
    partCount,
    recentAudit,
  ] = await Promise.all([
    prisma.station.count({ where: { active: true } }),
    prisma.workOrder.count({ where: { status: { in: ['released', 'in_progress'] } } }),
    prisma.unit.count(),
    prisma.nonconformanceRecord.count({ where: { status: 'open' } }),
    prisma.supplier.count(),
    prisma.partMaster.count(),
    prisma.event.findMany({
      where: { eventType: { startsWith: 'config_' } },
      orderBy: { timestampUtc: 'desc' },
      take: 5,
      select: {
        id: true,
        eventType: true,
        timestampUtc: true,
        operatorId: true,
        source: true,
      },
    }),
  ]);

  return { stationCount, activeWorkOrders, totalUnits, openNCRs, supplierCount, partCount, recentAudit };
}

export default async function AdminOverviewPage() {
  const stats = await getAdminStats();

  const sections = [
    {
      title: 'Production',
      color: 'bg-blue-600',
      items: [
        { title: 'Work Orders', href: '/admin/work-orders', Icon: FileText },
        { title: 'Stations', href: '/admin/stations', Icon: Factory, count: stats.stationCount },
        { title: 'Routings / BOM', href: '/admin/bom', Icon: ListOrdered },
        { title: 'Process Steps', href: '/admin/process-steps', Icon: ClipboardList },
      ],
    },
    {
      title: 'Quality',
      color: 'bg-green-600',
      items: [
        { title: 'Quality Checks', href: '/admin/quality-checks', Icon: ClipboardCheck },
        { title: 'CTQ Definitions', href: '/admin/ctq', Icon: Target },
        { title: 'EOL Tests', href: '/admin/eol-tests', Icon: TestTube2 },
        { title: 'IQC', href: '/admin/iqc', Icon: ShieldCheck },
      ],
    },
    {
      title: 'Supply Chain',
      color: 'bg-amber-600',
      items: [
        { title: 'Parts', href: '/admin/parts', Icon: Boxes },
        { title: 'Suppliers', href: '/admin/suppliers', Icon: Truck, count: stats.supplierCount },
        { title: 'Purchase Orders', href: '/admin/purchase-orders', Icon: ShoppingCart },
        { title: 'Receiving', href: '/admin/receiving', Icon: PackageOpen },
        { title: 'Kitting', href: '/admin/kitting', Icon: Package },
        { title: 'Shipping', href: '/admin/shipping', Icon: Send },
      ],
    },
    {
      title: 'System',
      color: 'bg-purple-600',
      items: [
        { title: 'Users', href: '/admin/users', Icon: Users },
        { title: 'Downtime Reasons', href: '/admin/downtime-reasons', Icon: Clock },
        { title: 'Audit Log', href: '/admin/audit-log', Icon: ScrollText },
        { title: 'API Keys', href: '/admin/api-keys', Icon: Key },
        { title: 'Webhooks', href: '/admin/webhooks', Icon: Webhook },
        { title: 'Exports', href: '/admin/exports', Icon: Download },
        { title: 'API Docs', href: '/admin/api-docs', Icon: BookOpen },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">System Administration</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage MES configuration and settings</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-green-50 border border-green-200 px-3 py-1">
          <Activity className="h-3.5 w-3.5 text-green-600" />
          <span className="text-xs font-medium text-green-700">System Healthy</span>
        </div>
      </div>

      {/* Inline Stats */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div>
          <span className="text-slate-500">Active WOs</span>
          <span className="ml-1.5 font-semibold text-blue-600">{stats.activeWorkOrders}</span>
        </div>
        <div>
          <span className="text-slate-500">Units</span>
          <span className="ml-1.5 font-semibold text-green-600">{stats.totalUnits}</span>
        </div>
        <div>
          <span className="text-slate-500">Open NCRs</span>
          <span className="ml-1.5 font-semibold text-red-600">{stats.openNCRs}</span>
        </div>
        <div>
          <span className="text-slate-500">Suppliers</span>
          <span className="ml-1.5 font-semibold text-amber-600">{stats.supplierCount}</span>
        </div>
        <div>
          <span className="text-slate-500">Parts</span>
          <span className="ml-1.5 font-semibold text-purple-600">{stats.partCount}</span>
        </div>
      </div>

      {/* Categorized Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sections.map((section) => (
          <div key={section.title} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className={`category-bar ${section.color}`}>
              {section.title}
            </div>
            <div className="divide-y divide-slate-100">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <item.Icon className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                    <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
                      {item.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.count !== undefined && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {item.count}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      {stats.recentAudit.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-slate-700 mb-2">Recent Config Changes</h2>
          <div className="border border-slate-200 rounded-lg bg-white divide-y divide-slate-100">
            {stats.recentAudit.map((event) => (
              <div key={event.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                <span className="text-slate-700 font-medium">
                  {event.eventType.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(event.timestampUtc).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
