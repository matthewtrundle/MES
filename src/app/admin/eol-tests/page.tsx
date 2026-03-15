import { getEolTestSuites, getRoutingsForEol } from '@/lib/actions/eol-testing';
import { EolTestSuiteTable } from '@/components/admin/EolTestSuiteTable';
import { EolTestSuiteForm } from '@/components/admin/EolTestSuiteForm';

export default async function EolTestsPage() {
  const [suites, routings] = await Promise.all([
    getEolTestSuites(),
    getRoutingsForEol(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">EOL Test Suites</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {suites.length} test suite{suites.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <EolTestSuiteForm routings={routings} />
      </div>

      <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
        <EolTestSuiteTable suites={suites} routings={routings} />
      </div>
    </div>
  );
}
