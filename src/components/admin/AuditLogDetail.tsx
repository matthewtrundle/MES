'use client';

import { useMemo } from 'react';

interface AuditLogDetailProps {
  beforeJson: unknown;
  afterJson: unknown;
  userName: string;
  userEmail: string;
  timestamp: string;
  entityType: string;
  entityId: string;
  action: string;
}

interface DiffEntry {
  key: string;
  before: string | undefined;
  after: string | undefined;
  changed: boolean;
}

function flattenObject(
  obj: unknown,
  prefix = ''
): Record<string, string> {
  const result: Record<string, string> = {};

  if (obj === null || obj === undefined) {
    return result;
  }

  if (typeof obj !== 'object') {
    result[prefix] = String(obj);
    return result;
  }

  const entries = Object.entries(obj as Record<string, unknown>);
  for (const [key, value] of entries) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, fullKey));
    } else {
      result[fullKey] = JSON.stringify(value);
    }
  }

  return result;
}

function computeDiff(before: unknown, after: unknown): DiffEntry[] {
  const beforeFlat = flattenObject(before);
  const afterFlat = flattenObject(after);
  const allKeys = new Set([...Object.keys(beforeFlat), ...Object.keys(afterFlat)]);
  const entries: DiffEntry[] = [];

  for (const key of Array.from(allKeys).sort()) {
    const bVal = beforeFlat[key];
    const aVal = afterFlat[key];
    entries.push({
      key,
      before: bVal,
      after: aVal,
      changed: bVal !== aVal,
    });
  }

  return entries;
}

export function AuditLogDetail({
  beforeJson,
  afterJson,
  userName,
  userEmail,
  timestamp,
  entityType,
  entityId,
  action,
}: AuditLogDetailProps) {
  const diff = useMemo(() => computeDiff(beforeJson, afterJson), [beforeJson, afterJson]);
  const hasBeforeAndAfter = beforeJson !== null && afterJson !== null;

  return (
    <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-4">
      {/* Meta info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-slate-500 block">User</span>
          <span className="font-medium text-slate-900">{userName}</span>
          <span className="text-slate-400 block text-xs">{userEmail}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Action</span>
          <span className="font-medium text-slate-900 capitalize">{action.replace('_', ' ')}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Entity</span>
          <span className="font-medium text-slate-900">{entityType}</span>
          <span className="text-slate-400 block text-xs font-mono">{entityId}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Timestamp</span>
          <span className="font-medium text-slate-900">
            {new Date(timestamp).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Diff view */}
      {hasBeforeAndAfter && diff.length > 0 ? (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2">Changes</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-1">
              Before
            </div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-1">
              After
            </div>
          </div>
          <div className="border rounded-md overflow-hidden bg-white divide-y divide-slate-100">
            {diff.map((entry) => (
              <div
                key={entry.key}
                className={`grid grid-cols-1 md:grid-cols-2 gap-0 text-sm ${
                  entry.changed ? 'bg-amber-50' : ''
                }`}
              >
                <div className="px-3 py-1.5 border-r border-slate-100">
                  <span className="text-slate-500 text-xs mr-2">{entry.key}:</span>
                  {entry.before !== undefined ? (
                    <span
                      className={`font-mono text-xs ${
                        entry.changed ? 'text-red-700 bg-red-50 px-1 rounded' : 'text-slate-700'
                      }`}
                    >
                      {entry.before}
                    </span>
                  ) : (
                    <span className="text-slate-300 text-xs italic">--</span>
                  )}
                </div>
                <div className="px-3 py-1.5">
                  <span className="text-slate-500 text-xs mr-2 md:hidden">{entry.key}:</span>
                  {entry.after !== undefined ? (
                    <span
                      className={`font-mono text-xs ${
                        entry.changed ? 'text-green-700 bg-green-50 px-1 rounded' : 'text-slate-700'
                      }`}
                    >
                      {entry.after}
                    </span>
                  ) : (
                    <span className="text-slate-300 text-xs italic">--</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Single JSON display for create/delete */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {beforeJson !== null && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Before (Removed)</h4>
              <pre className="bg-white border border-red-200 rounded-md p-3 text-xs font-mono text-red-800 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                {JSON.stringify(beforeJson, null, 2)}
              </pre>
            </div>
          )}
          {afterJson !== null && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">After (Created)</h4>
              <pre className="bg-white border border-green-200 rounded-md p-3 text-xs font-mono text-green-800 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                {JSON.stringify(afterJson, null, 2)}
              </pre>
            </div>
          )}
          {beforeJson === null && afterJson === null && (
            <div className="col-span-2 text-sm text-slate-400 italic">
              No before/after data recorded for this entry.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
