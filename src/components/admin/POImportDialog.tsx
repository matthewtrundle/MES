'use client';

import { useState, useTransition, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  importPurchaseOrdersFromCSV,
  generatePOImportTemplate,
} from '@/lib/actions/po-import';

type PreviewRow = Record<string, string>;

type ImportResult = {
  created: number;
  errors: Array<{ row: number; message: string }>;
} | null;

export function POImportDialog() {
  const [open, setOpen] = useState(false);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [groupCount, setGroupCount] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setCsvContent(null);
    setFileName(null);
    setPreviewRows([]);
    setPreviewHeaders([]);
    setTotalRows(0);
    setGroupCount(0);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportResult(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);

      // Parse for preview
      const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
      if (lines.length < 2) {
        setPreviewRows([]);
        setPreviewHeaders([]);
        setTotalRows(0);
        setGroupCount(0);
        return;
      }

      const headers = parseCSVLine(lines[0]);
      setPreviewHeaders(headers);

      const dataLines = lines.slice(1);
      setTotalRows(dataLines.length);

      // Build preview rows (first 5)
      const preview: PreviewRow[] = [];
      for (let i = 0; i < Math.min(5, dataLines.length); i++) {
        const values = parseCSVLine(dataLines[i]);
        const row: PreviewRow = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] ?? '';
        });
        preview.push(row);
      }
      setPreviewRows(preview);

      // Count PO groups
      const groups = new Set<string>();
      for (const line of dataLines) {
        const values = parseCSVLine(line);
        const supplierIdx = headers.indexOf('supplier_id');
        const dateIdx = headers.indexOf('order_date');
        const buyerIdx = headers.indexOf('buyer_name');
        if (supplierIdx >= 0 && dateIdx >= 0 && buyerIdx >= 0) {
          groups.add(`${values[supplierIdx]}|${values[dateIdx]}|${values[buyerIdx]}`);
        }
      }
      setGroupCount(groups.size);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!csvContent) return;
    startTransition(async () => {
      try {
        const result = await importPurchaseOrdersFromCSV(csvContent);
        setImportResult(result);
        if (result.errors.length === 0) {
          // Clear file state on success, keep result visible
          setCsvContent(null);
          setFileName(null);
          setPreviewRows([]);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      } catch (err) {
        setImportResult({
          created: 0,
          errors: [{ row: 0, message: err instanceof Error ? err.message : 'Import failed' }],
        });
      }
    });
  };

  const handleDownloadTemplate = () => {
    startTransition(async () => {
      try {
        const csv = await generatePOImportTemplate();
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'po-import-template.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        // Silently fail template download
      }
    });
  };

  // Visible preview columns (show a subset to avoid horizontal overflow)
  const displayHeaders = previewHeaders.slice(0, 6);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Purchase Orders from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk-create purchase orders. Rows are grouped by
            supplier, order date, and buyer name.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File input and template download */}
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDownloadTemplate}
              disabled={isPending}
              className="whitespace-nowrap text-blue-600 hover:text-blue-800"
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Template
            </Button>
          </div>

          {/* Preview */}
          {previewRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-slate-600">
                  <strong>{totalRows}</strong> row{totalRows !== 1 ? 's' : ''} detected
                </span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-600">
                  <strong>{groupCount}</strong> PO{groupCount !== 1 ? 's' : ''} will be
                  created
                </span>
              </div>

              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      {displayHeaders.map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                      {previewHeaders.length > 6 && (
                        <th className="px-3 py-2 text-left font-medium text-slate-400">
                          +{previewHeaders.length - 6} more
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-b last:border-b-0">
                        {displayHeaders.map((h) => (
                          <td
                            key={h}
                            className="px-3 py-1.5 text-slate-700 whitespace-nowrap max-w-[150px] truncate"
                          >
                            {row[h] || '-'}
                          </td>
                        ))}
                        {previewHeaders.length > 6 && (
                          <td className="px-3 py-1.5 text-slate-400">...</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalRows > 5 && (
                <p className="text-xs text-slate-400">
                  Showing first 5 of {totalRows} rows
                </p>
              )}
            </div>
          )}

          {/* Import result */}
          {importResult && (
            <div className="space-y-2">
              {importResult.created > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-green-800">
                    Successfully created {importResult.created} purchase order
                    {importResult.created !== 1 ? 's' : ''}
                  </p>
                </div>
              )}

              {importResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                  <p className="text-sm font-medium text-red-800">
                    {importResult.errors.length} error
                    {importResult.errors.length !== 1 ? 's' : ''} found:
                  </p>
                  <ul className="text-xs text-red-700 space-y-1 max-h-40 overflow-y-auto">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>
                        {err.row > 0 ? `Row ${err.row}: ` : ''}
                        {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            {importResult?.created ? 'Close' : 'Cancel'}
          </Button>
          {csvContent && (
            <Button
              type="button"
              onClick={handleImport}
              disabled={isPending || !csvContent}
            >
              {isPending ? 'Importing...' : `Import ${groupCount} PO${groupCount !== 1 ? 's' : ''}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Simple CSV line parser for client-side preview.
 * Handles quoted fields with embedded commas.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        current += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
  }
  result.push(current.trim());
  return result;
}
