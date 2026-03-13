/**
 * CSV Utilities — parse and generate RFC 4180 compliant CSV
 */

export type CSVRow = Record<string, string>;

/**
 * Parse a CSV string into an array of objects keyed by header names.
 * Handles quoted fields, embedded commas, escaped quotes, and CRLF/LF line endings.
 */
export function parseCSV(csv: string): CSVRow[] {
  const rows = parseCSVRows(csv);
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  const result: CSVRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Skip empty rows
    if (row.length === 1 && row[0].trim() === '') continue;

    const obj: CSVRow = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = (row[j] ?? '').trim();
    }
    result.push(obj);
  }

  return result;
}

/**
 * Low-level RFC 4180 CSV row parser. Returns array of arrays of strings.
 */
function parseCSVRows(csv: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < csv.length) {
    const char = csv[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote ""
        if (i + 1 < csv.length && csv[i + 1] === '"') {
          currentField += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        currentField += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
        i++;
      } else if (char === '\r') {
        // Handle CRLF
        currentRow.push(currentField);
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
        i++;
        if (i < csv.length && csv[i] === '\n') {
          i++;
        }
      } else if (char === '\n') {
        currentRow.push(currentField);
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
        i++;
      } else {
        currentField += char;
        i++;
      }
    }
  }

  // Push last field/row if there's content
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Convert an array of objects to a CSV string.
 */
export function toCSV(rows: Record<string, unknown>[], headers?: string[]): string {
  if (rows.length === 0) return '';

  const cols = headers ?? Object.keys(rows[0]);
  const lines: string[] = [cols.map(escapeCSVField).join(',')];

  for (const row of rows) {
    const values = cols.map((col) => {
      const val = row[col];
      return escapeCSVField(val == null ? '' : String(val));
    });
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
