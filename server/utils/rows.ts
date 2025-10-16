/**
 * Converts 2D array of values to array of objects using headers
 */
export function rowsToObjects(values: string[][]): Array<Record<string, string>> {
  if (values.length === 0) {
    return [];
  }
  
  const [headers, ...rows] = values;
  
  return rows.map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] || '';
    });
    return obj;
  });
}

/**
 * Parses boolean from string (1/0/TRUE/FALSE/true/false)
 */
export function parseBool(value: string | undefined): boolean {
  if (!value) return false;
  const lower = value.toLowerCase().trim();
  return lower === '1' || lower === 'true' || lower === 'yes';
}

/**
 * Parses number, returns undefined for blanks
 */
export function parseNumber(value: string | undefined): number | undefined {
  if (!value || value.trim() === '') return undefined;
  const num = parseFloat(value);
  return isNaN(num) ? undefined : num;
}

/**
 * Parses JSON array or splits by delimiter
 */
export function parseJSONorSplit(value: string | undefined): string[] | undefined {
  if (!value || value.trim() === '') return undefined;
  
  // Try parsing as JSON first
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map(s => String(s).trim()).filter(s => s);
    }
  } catch {
    // Not JSON, try splitting
  }
  
  // Split by semicolon or comma
  return value.split(/[;,]/).map(s => s.trim()).filter(s => s);
}

/**
 * Parses price from dollars/cents to cents (123.45 → 12345)
 */
export function parsePrice(value: string | undefined): number | undefined {
  const num = parseNumber(value);
  if (num === undefined) return undefined;
  return Math.round(num * 100);
}

/**
 * Converts string to array by splitting on ; or ,
 */
export function toStringArray(value: string | undefined): string[] | undefined {
  if (!value || value.trim() === '') return undefined;
  return value.split(/[;,]/).map(s => s.trim()).filter(s => s);
}
