import { getTravelerData } from '@/lib/actions/traveler';
import { ASSEMBLY_GROUP_LABELS, ASSEMBLY_GROUP_ORDER, type AssemblyGroup } from '@/lib/types/process-steps';
import { normalizeDataFields, type DataFieldDefinition } from '@/lib/types/process-steps';
import { Badge } from '@/components/ui/badge';
import { TravelerPrintButton } from './TravelerPrintButton';

export const revalidate = 60;

interface TravelerPageProps {
  params: Promise<{ workOrderId: string }>;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'text-green-700 bg-green-50 border-green-200';
    case 'in_progress': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    case 'pending': return 'text-slate-500 bg-slate-50 border-slate-200';
    case 'released': return 'text-blue-700 bg-blue-50 border-blue-200';
    default: return 'text-slate-500 bg-slate-50 border-slate-200';
  }
}

function StepStatusIndicator({ hasCaptures, result }: { hasCaptures: boolean; result?: string }) {
  if (!hasCaptures) {
    return (
      <div className="w-6 h-6 rounded-full border-2 border-slate-300 bg-white print:border-slate-400" title="Pending" />
    );
  }
  if (result === 'pass') {
    return (
      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center print:bg-green-600" title="Completed">
        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  if (result === 'fail') {
    return (
      <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center print:bg-red-600" title="Failed">
        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded-full bg-yellow-400 flex items-center justify-center" title="Incomplete">
      <div className="w-2 h-2 rounded-full bg-white" />
    </div>
  );
}

export default async function TravelerPage({ params }: TravelerPageProps) {
  const { workOrderId } = await params;
  const data = await getTravelerData(workOrderId);
  const { workOrder, operations, bomItems, processSteps, qualityChecks, units } = data;

  // Group process steps by category (assembly group)
  const stepsByGroup = new Map<string, typeof processSteps>();
  for (const step of processSteps) {
    const existing = stepsByGroup.get(step.category) ?? [];
    existing.push(step);
    stepsByGroup.set(step.category, existing);
  }

  // Group BOM items by station
  const bomByStation = new Map<string, typeof bomItems>();
  for (const item of bomItems) {
    const existing = bomByStation.get(item.stationName) ?? [];
    existing.push(item);
    bomByStation.set(item.stationName, existing);
  }

  return (
    <>
      {/* Print-friendly styles */}
      <style>{`
        @media print {
          /* Hide non-printable elements */
          nav, header, aside, .no-print, [data-no-print] {
            display: none !important;
          }
          /* Reset page margins */
          @page {
            margin: 0.5in;
            size: letter;
          }
          body {
            font-size: 10pt;
            color: #000 !important;
            background: white !important;
          }
          /* Ensure backgrounds print */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Page break control */
          .page-break-before {
            page-break-before: always;
          }
          .avoid-break {
            page-break-inside: avoid;
          }
          /* Compact spacing for print */
          .print-compact {
            padding: 0.25rem !important;
          }
        }
      `}</style>

      <div className="max-w-5xl mx-auto space-y-6 p-4 print:p-0 print:max-w-none">
        {/* Header with Print Button */}
        <div className="flex items-center justify-between no-print">
          <h1 className="text-lg font-bold text-slate-900">Production Traveler</h1>
          <TravelerPrintButton />
        </div>

        {/* ===== TRAVELER HEADER ===== */}
        <div className="border-2 border-slate-900 rounded-lg overflow-hidden avoid-break print:border-black">
          <div className="bg-slate-900 text-white px-6 py-3 print:bg-black">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-wide">PRODUCTION TRAVELER</h2>
              <span className="text-sm opacity-80">Doc: TRV-{workOrder.orderNumber}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-y divide-slate-300 print:divide-slate-400">
            <div className="p-3">
              <div className="text-xs font-semibold text-slate-500 uppercase">Work Order</div>
              <div className="font-mono font-bold text-lg">{workOrder.orderNumber}</div>
            </div>
            <div className="p-3">
              <div className="text-xs font-semibold text-slate-500 uppercase">Product</div>
              <div className="font-mono font-bold">{workOrder.productCode}</div>
              {workOrder.productName && (
                <div className="text-sm text-slate-600">{workOrder.productName}</div>
              )}
            </div>
            <div className="p-3">
              <div className="text-xs font-semibold text-slate-500 uppercase">Quantity</div>
              <div className="font-bold text-lg">
                {workOrder.qtyCompleted} / {workOrder.qtyOrdered}
              </div>
            </div>
            <div className="p-3">
              <div className="text-xs font-semibold text-slate-500 uppercase">Status</div>
              <Badge className={getStatusColor(workOrder.status)}>
                {workOrder.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
            <div className="p-3">
              <div className="text-xs font-semibold text-slate-500 uppercase">Site</div>
              <div className="text-sm">{workOrder.siteName}</div>
            </div>
            <div className="p-3">
              <div className="text-xs font-semibold text-slate-500 uppercase">Routing</div>
              <div className="text-sm">{workOrder.routingName ?? 'N/A'}</div>
            </div>
            <div className="p-3">
              <div className="text-xs font-semibold text-slate-500 uppercase">Released</div>
              <div className="text-sm">
                {workOrder.releasedAt
                  ? new Date(workOrder.releasedAt).toLocaleDateString()
                  : 'Not released'}
              </div>
            </div>
            <div className="p-3">
              <div className="text-xs font-semibold text-slate-500 uppercase">Due Date</div>
              <div className="text-sm">
                {workOrder.dueDate
                  ? new Date(workOrder.dueDate).toLocaleDateString()
                  : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* ===== ROUTING / OPERATIONS ===== */}
        <div className="border rounded-lg overflow-hidden avoid-break">
          <div className="bg-slate-100 px-4 py-2 border-b">
            <h3 className="font-bold text-slate-800">Routing Operations</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left px-4 py-2 font-semibold">Seq</th>
                <th className="text-left px-4 py-2 font-semibold">Station</th>
                <th className="text-left px-4 py-2 font-semibold">Est. Time</th>
                <th className="text-left px-4 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {operations.map((op) => (
                <tr key={op.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-mono">{op.sequence}</td>
                  <td className="px-4 py-2 font-medium">{op.stationName}</td>
                  <td className="px-4 py-2">{op.estimatedMinutes ? `${op.estimatedMinutes} min` : '-'}</td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className={getStatusColor(op.status)}>
                      {op.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ===== BILL OF MATERIALS ===== */}
        <div className="border rounded-lg overflow-hidden avoid-break">
          <div className="bg-slate-100 px-4 py-2 border-b">
            <h3 className="font-bold text-slate-800">Bill of Materials</h3>
          </div>
          {bomItems.length === 0 ? (
            <div className="px-4 py-6 text-center text-slate-500">No BOM items defined</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-4 py-2 font-semibold">Material Code</th>
                  <th className="text-left px-4 py-2 font-semibold">Description</th>
                  <th className="text-left px-4 py-2 font-semibold">Qty/Unit</th>
                  <th className="text-left px-4 py-2 font-semibold">UOM</th>
                  <th className="text-left px-4 py-2 font-semibold">Station</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(bomByStation.entries()).map(([stationName, items]) => (
                  items.map((item, idx) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="px-4 py-2 font-mono text-xs">{item.materialCode}</td>
                      <td className="px-4 py-2">{item.description ?? '-'}</td>
                      <td className="px-4 py-2 font-mono">{item.qtyPerUnit}</td>
                      <td className="px-4 py-2">{item.unitOfMeasure}</td>
                      {idx === 0 && (
                        <td className="px-4 py-2 font-medium" rowSpan={items.length}>
                          {stationName}
                        </td>
                      )}
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ===== PROCESS STEPS BY ASSEMBLY GROUP ===== */}
        <div className="page-break-before" />
        <div className="border-2 border-slate-900 rounded-lg overflow-hidden print:border-black">
          <div className="bg-slate-900 text-white px-4 py-2 print:bg-black">
            <h3 className="font-bold">Process Steps &amp; Sign-Off Record</h3>
          </div>

          {ASSEMBLY_GROUP_ORDER.map((group) => {
            const steps = stepsByGroup.get(group);
            if (!steps || steps.length === 0) return null;

            return (
              <div key={group} className="avoid-break">
                <div className="bg-slate-200 px-4 py-2 border-y border-slate-300 print:bg-slate-100">
                  <h4 className="font-bold text-slate-700">
                    {ASSEMBLY_GROUP_LABELS[group as AssemblyGroup]}
                  </h4>
                </div>
                {steps.map((step) => {
                  const fields = normalizeDataFields(step.dataFields);
                  const hasCaptures = step.captures.length > 0;
                  const latestCapture = step.captures[0];
                  const signedOff = latestCapture?.signedOff;

                  return (
                    <div
                      key={step.id}
                      className={`border-b last:border-0 ${
                        hasCaptures && signedOff
                          ? 'bg-green-50 print:bg-green-50'
                          : hasCaptures && !signedOff
                          ? 'bg-yellow-50 print:bg-yellow-50'
                          : 'bg-white'
                      }`}
                    >
                      {/* Step header */}
                      <div className="flex items-start gap-3 px-4 py-3">
                        <StepStatusIndicator
                          hasCaptures={hasCaptures}
                          result={signedOff ? 'pass' : hasCaptures ? 'pending' : undefined}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-slate-500">
                              Step {step.sequenceOrder}
                            </span>
                            <span className="font-semibold">{step.name}</span>
                            {step.isMandatory && (
                              <span className="text-red-500 text-xs font-bold">*REQ</span>
                            )}
                          </div>
                          {step.description && (
                            <p className="text-sm text-slate-600 mt-0.5">{step.description}</p>
                          )}
                          <div className="text-xs text-slate-400 mt-0.5">
                            Station: {step.stationName}
                            {step.cycleTimeTarget && ` | Target: ${step.cycleTimeTarget}s`}
                          </div>
                        </div>
                      </div>

                      {/* Data fields table */}
                      {fields.length > 0 && (
                        <div className="mx-4 mb-3">
                          <table className="w-full text-xs border border-slate-200 rounded">
                            <thead>
                              <tr className="bg-slate-50 border-b">
                                <th className="text-left px-2 py-1 font-semibold w-1/4">Field</th>
                                <th className="text-left px-2 py-1 font-semibold w-1/6">Type</th>
                                <th className="text-left px-2 py-1 font-semibold w-1/4">Spec</th>
                                <th className="text-left px-2 py-1 font-semibold w-1/3">
                                  Value / Reading
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {fields.map((field) => {
                                const capturedValue = latestCapture
                                  ? (latestCapture.capturedData as Record<string, unknown>)?.[field.id]
                                  : undefined;

                                return (
                                  <tr key={field.id} className="border-b last:border-0">
                                    <td className="px-2 py-1.5 font-medium">
                                      {field.name}
                                      {field.required && <span className="text-red-500">*</span>}
                                    </td>
                                    <td className="px-2 py-1.5 text-slate-500">
                                      {field.type}
                                      {field.unit && ` (${field.unit})`}
                                    </td>
                                    <td className="px-2 py-1.5 font-mono text-slate-600">
                                      {field.min !== undefined && field.max !== undefined
                                        ? `${field.min} - ${field.max}`
                                        : field.options
                                        ? field.options.join(' | ')
                                        : '-'}
                                    </td>
                                    <td className="px-2 py-1.5">
                                      {capturedValue !== undefined ? (
                                        <span className="font-mono font-semibold">
                                          {String(capturedValue)}
                                        </span>
                                      ) : (
                                        <div className="border-b border-dashed border-slate-300 h-5 print:min-w-[100px]" />
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Sign-off area */}
                      <div className="mx-4 mb-3 flex items-center gap-6 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-600">Operator:</span>
                          {latestCapture ? (
                            <span className="font-medium">{latestCapture.operatorId}</span>
                          ) : (
                            <span className="inline-block border-b border-dashed border-slate-300 w-32 print:w-40" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-600">Date/Time:</span>
                          {latestCapture?.signedOffAt ? (
                            <span className="font-mono">
                              {new Date(latestCapture.signedOffAt).toLocaleString()}
                            </span>
                          ) : (
                            <span className="inline-block border-b border-dashed border-slate-300 w-32 print:w-40" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-600">Signed Off:</span>
                          {latestCapture ? (
                            <Badge
                              variant="outline"
                              className={
                                signedOff
                                  ? 'border-green-500 text-green-700'
                                  : 'border-yellow-500 text-yellow-700'
                              }
                            >
                              {signedOff ? 'YES' : 'PENDING'}
                            </Badge>
                          ) : (
                            <span className="inline-block border-b border-dashed border-slate-300 w-16" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* ===== QUALITY CHECKS ===== */}
        {qualityChecks.length > 0 && (
          <div className="border rounded-lg overflow-hidden avoid-break">
            <div className="bg-slate-100 px-4 py-2 border-b">
              <h3 className="font-bold text-slate-800">Quality Check Requirements</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-4 py-2 font-semibold">Check Name</th>
                  <th className="text-left px-4 py-2 font-semibold">Type</th>
                  <th className="text-left px-4 py-2 font-semibold">Station(s)</th>
                  <th className="text-left px-4 py-2 font-semibold">Signature</th>
                </tr>
              </thead>
              <tbody>
                {qualityChecks.map((qc) => (
                  <tr key={qc.id} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">{qc.name}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline">{qc.checkType.replace('_', ' ')}</Badge>
                    </td>
                    <td className="px-4 py-2 text-sm">{qc.stationNames.join(', ')}</td>
                    <td className="px-4 py-2">
                      <div className="border-b border-dashed border-slate-300 w-32 print:w-40" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== UNITS TRACKING ===== */}
        {units.length > 0 && (
          <div className="border rounded-lg overflow-hidden avoid-break">
            <div className="bg-slate-100 px-4 py-2 border-b">
              <h3 className="font-bold text-slate-800">Unit Tracking</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-4 py-2 font-semibold">Serial Number</th>
                  <th className="text-left px-4 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => (
                  <tr key={unit.id} className="border-b last:border-0">
                    <td className="px-4 py-2 font-mono">{unit.serialNumber}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={getStatusColor(unit.status)}>
                        {unit.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== FOOTER ===== */}
        <div className="border-t border-slate-300 pt-4 text-xs text-slate-400 flex justify-between">
          <span>Generated: {new Date().toLocaleString()}</span>
          <span>MES Traveler - {workOrder.orderNumber}</span>
        </div>
      </div>
    </>
  );
}
