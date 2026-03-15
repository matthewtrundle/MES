import { getProcessStepDefinitions, getStationsForProcessSteps } from '@/lib/actions/admin/process-steps';
import { ProcessStepTable } from '@/components/admin/ProcessStepTable';
import { ProcessStepForm } from '@/components/admin/ProcessStepForm';
import { STEP_CATEGORIES } from '@/lib/types/process-steps';

export default async function ProcessStepsPage() {
  const [definitions, stations] = await Promise.all([
    getProcessStepDefinitions(),
    getStationsForProcessSteps(),
  ]);

  const grouped = STEP_CATEGORIES.map((cat) => ({
    ...cat,
    steps: definitions.filter((d) => d.category === cat.value),
  }));

  const activeSteps = definitions.filter((d) => d.active).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Process Step Definitions</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {definitions.length} step{definitions.length !== 1 ? 's' : ''} &middot; {activeSteps} active &middot; {grouped.filter((g) => g.steps.length > 0).length} categories
          </p>
        </div>
        <ProcessStepForm stations={stations} />
      </div>

      {/* Steps grouped by category */}
      {grouped.map((group) => (
        <div key={group.value}>
          <h2 className="text-sm font-medium text-slate-700 mb-2">
            {group.label}
            <span className="text-slate-400 font-normal ml-1">({group.steps.length})</span>
          </h2>
          <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
            {group.steps.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">
                No steps configured for this category
              </p>
            ) : (
              <ProcessStepTable definitions={group.steps} stations={stations} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
