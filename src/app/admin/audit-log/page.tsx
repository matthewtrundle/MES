import { getAuditLogs, getAuditLogStats, getAuditLogFilterOptions } from '@/lib/actions/admin/audit-logs';
import { AuditLogViewer } from '@/components/admin/AuditLogViewer';

export default async function AuditLogPage() {
  const [initialData, stats, filterOptions] = await Promise.all([
    getAuditLogs({ page: 1, pageSize: 25 }),
    getAuditLogStats(),
    getAuditLogFilterOptions(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
        <p className="text-slate-500 mt-1">
          Track all configuration changes and administrative actions
        </p>
      </div>

      <AuditLogViewer
        initialData={initialData}
        stats={stats}
        filterOptions={filterOptions}
      />
    </div>
  );
}
