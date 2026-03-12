/**
 * CSV utility — RFC 4180 compliant CSV generation.
 */

/**
 * Escape a single CSV field per RFC 4180:
 *  - If the value contains a comma, double-quote, or newline, wrap in double-quotes
 *  - Double-quotes inside the value are escaped by doubling them
 */
function escapeField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Format a cell value to a string suitable for CSV output.
 *  - null / undefined -> empty string
 *  - Date objects -> ISO string
 *  - numbers -> string representation
 */
function formatCell(value: string | number | boolean | Date | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

/**
 * Convert headers and rows to a CSV string (RFC 4180).
 *
 * @param headers - Column header names
 * @param rows    - Array of row arrays; each cell can be string, number, Date, null, or undefined
 * @returns       - Complete CSV string with CRLF line endings
 */
export function toCSV(
  headers: string[],
  rows: (string | number | boolean | Date | null | undefined)[][],
): string {
  const lines: string[] = [];

  // Header row
  lines.push(headers.map(h => escapeField(h)).join(','));

  // Data rows
  for (const row of rows) {
    const cells = row.map(cell => escapeField(formatCell(cell)));
    lines.push(cells.join(','));
  }

  return lines.join('\r\n') + '\r\n';
}
