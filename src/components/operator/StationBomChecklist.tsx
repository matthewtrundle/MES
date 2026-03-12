'use client';

interface BomItem {
  materialCode: string;
  description: string | null;
  qtyPerUnit: number;
  unitOfMeasure: string;
}

export function StationBomChecklist({ items }: { items: BomItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
      <h3 className="text-sm font-semibold text-blue-800 mb-2">Required Materials</h3>
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
    </div>
  );
}
