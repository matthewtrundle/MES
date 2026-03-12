'use client';

import { ASSEMBLY_GROUP_LABELS } from '@/lib/types/assembly-groups';

interface BomItem {
  materialCode: string;
  description: string | null;
  qtyPerUnit: number;
  unitOfMeasure: string;
  assemblyGroup?: string | null;
}

export function StationBomChecklist({ items }: { items: BomItem[] }) {
  if (items.length === 0) return null;

  // Group items by assemblyGroup
  const grouped: Record<string, BomItem[]> = {};
  for (const item of items) {
    const group = item.assemblyGroup || 'ungrouped';
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(item);
  }

  const groupOrder = ['stator', 'rotor', 'wire_harness', 'base', 'final_assembly', 'ungrouped'];
  const sortedGroups = Object.keys(grouped).sort(
    (a, b) => (groupOrder.indexOf(a) === -1 ? 999 : groupOrder.indexOf(a)) - (groupOrder.indexOf(b) === -1 ? 999 : groupOrder.indexOf(b))
  );

  const hasGroups = sortedGroups.length > 1 || (sortedGroups.length === 1 && sortedGroups[0] !== 'ungrouped');

  return (
    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
      <h3 className="text-sm font-semibold text-blue-800 mb-2">Required Materials</h3>
      {hasGroups ? (
        <div className="space-y-3">
          {sortedGroups.map((group) => {
            const groupItems = grouped[group];
            const label = group === 'ungrouped'
              ? 'Other'
              : ASSEMBLY_GROUP_LABELS[group] || group;

            return (
              <div key={group}>
                <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">
                  {label}
                </div>
                <div className="space-y-1">
                  {groupItems.map((item) => (
                    <div key={item.materialCode} className="flex items-center justify-between text-sm">
                      <span className="text-blue-900">
                        {item.description ?? item.materialCode}
                      </span>
                      <span className="text-blue-600 font-mono text-xs">
                        {item.qtyPerUnit} {item.unitOfMeasure}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={item.materialCode} className="flex items-center justify-between text-sm">
              <span className="text-blue-900">
                {item.description ?? item.materialCode}
              </span>
              <span className="text-blue-600 font-mono text-xs">
                {item.qtyPerUnit} {item.unitOfMeasure}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
