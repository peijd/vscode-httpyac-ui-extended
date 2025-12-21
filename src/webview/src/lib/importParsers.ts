export interface ParsedPair {
  key: string;
  value: string;
}

export function parseHeaderLines(text: string): ParsedPair[] {
  const lines = text.split(/\r?\n/u);
  const results: ParsedPair[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
      continue;
    }
    const match = trimmed.match(/^([^:]+):\s*(.*)$/u);
    if (match) {
      results.push({ key: match[1].trim(), value: match[2].trim() });
    }
  }
  return results;
}

export function parseParamText(text: string): ParsedPair[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  const query = trimmed.includes('?') ? trimmed.split('?')[1] || '' : trimmed;
  const normalized = query.trim();
  if (!normalized) {
    return [];
  }
  const results: ParsedPair[] = [];
  try {
    const params = new URLSearchParams(normalized.startsWith('?') ? normalized.slice(1) : normalized);
    params.forEach((value, key) => {
      results.push({ key, value });
    });
    if (results.length > 0) {
      return results;
    }
  } catch {
    // fallback below
  }
  const pairs = normalized.split(/[&\n]/u).map(part => part.trim()).filter(Boolean);
  for (const pair of pairs) {
    const [key, ...rest] = pair.split('=');
    if (key) {
      results.push({ key: key.trim(), value: rest.join('=').trim() });
    }
  }
  return results;
}

export function parseCurlHeaders(text: string): ParsedPair[] {
  const results: ParsedPair[] = [];
  const headerRegex = /(?:-H|--header)\s+(?:'([^']*)'|"([^"]*)"|([^\s]+))/gu;
  let match: RegExpExecArray | null;
  while ((match = headerRegex.exec(text)) !== null) {
    const header = match[1] || match[2] || match[3] || '';
    const parts = header.split(/:\s*/u);
    const key = parts.shift()?.trim() || '';
    if (!key) {
      continue;
    }
    const value = parts.join(':').trim();
    results.push({ key, value });
  }
  return results;
}

export function parseCurlParams(text: string): ParsedPair[] {
  const url = extractCurlUrl(text);
  if (!url) {
    return [];
  }
  try {
    const parsed = new URL(url);
    const results: ParsedPair[] = [];
    parsed.searchParams.forEach((value, key) => {
      results.push({ key, value });
    });
    return results;
  } catch {
    return [];
  }
}

export function extractCurlUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s'"]+/u);
  return match ? match[0] : null;
}

export function extractCurlBaseUrl(text: string): string | null {
  const url = extractCurlUrl(text);
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return null;
  }
}
