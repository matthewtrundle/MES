import { ExportDashboard } from '@/components/admin/ExportDashboard';

export default function ExportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Data Export</h1>
        <p className="text-sm text-slate-500 mt-1">
          Export production data as CSV files for analysis and reporting
        </p>
      </div>
      <ExportDashboard />
    </div>
  );
}
