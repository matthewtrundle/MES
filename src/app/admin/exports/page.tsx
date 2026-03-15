import { ExportDashboard } from '@/components/admin/ExportDashboard';

export default function ExportsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Data Export</h1>
        <p className="text-sm text-sm text-slate-500 mt-0.5">
          Export production data as CSV files for analysis and reporting
        </p>
      </div>
      <ExportDashboard />
    </div>
  );
}
