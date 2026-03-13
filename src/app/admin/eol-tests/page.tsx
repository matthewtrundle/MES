import { getEolTestSuites, getRoutingsForEol } from '@/lib/actions/eol-testing';
import { EolTestSuiteTable } from '@/components/admin/EolTestSuiteTable';
import { EolTestSuiteForm } from '@/components/admin/EolTestSuiteForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function EolTestsPage() {
  const [suites, routings] = await Promise.all([
    getEolTestSuites(),
    getRoutingsForEol(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">EOL Test Suites</h1>
          <p className="text-slate-500 mt-1">
            Configure End-of-Line test parameters that must pass before serial number assignment
          </p>
        </div>
        <EolTestSuiteForm routings={routings} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All EOL Test Suites</CardTitle>
          <CardDescription>
            {suites.length} EOL test suite{suites.length !== 1 ? 's' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EolTestSuiteTable suites={suites} routings={routings} />
        </CardContent>
      </Card>
    </div>
  );
}
