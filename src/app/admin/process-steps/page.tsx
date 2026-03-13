import { getProcessStepDefinitions, getStationsForProcessSteps } from '@/lib/actions/admin/process-steps';
import { ProcessStepTable } from '@/components/admin/ProcessStepTable';
import { ProcessStepForm } from '@/components/admin/ProcessStepForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { STEP_CATEGORIES } from '@/lib/types/process-steps';

export const dynamic = 'force-dynamic';

export default async function ProcessStepsPage() {
  const [definitions, stations] = await Promise.all([
    getProcessStepDefinitions(),
    getStationsForProcessSteps(),
  ]);

  // Group by category
  const grouped = STEP_CATEGORIES.map((cat) => ({
    ...cat,
    steps: definitions.filter((d) => d.category === cat.value),
  }));

  const totalSteps = definitions.length;
  const activeSteps = definitions.filter((d) => d.active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Process Step Definitions</h1>
          <p className="text-slate-500 mt-1">
            Configure data capture fields for each process step
          </p>
        </div>
        <ProcessStepForm stations={stations} />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Steps</CardDescription>
            <CardTitle className="text-3xl">{totalSteps}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Steps</CardDescription>
            <CardTitle className="text-3xl text-green-600">{activeSteps}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Categories</CardDescription>
            <CardTitle className="text-3xl">{grouped.filter((g) => g.steps.length > 0).length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Steps grouped by category */}
      {grouped.map((group) => (
        <Card key={group.value}>
          <CardHeader>
            <CardTitle>{group.label}</CardTitle>
            <CardDescription>
              {group.steps.length} step{group.steps.length !== 1 ? 's' : ''} configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            {group.steps.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">
                No steps configured for this category
              </p>
            ) : (
              <ProcessStepTable definitions={group.steps} stations={stations} />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
