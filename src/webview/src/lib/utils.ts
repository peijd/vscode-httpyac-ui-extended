import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: 'method-get',
    POST: 'method-post',
    PUT: 'method-put',
    DELETE: 'method-delete',
    PATCH: 'method-patch',
    OPTIONS: 'method-options',
    HEAD: 'method-head',
  };
  return colors[method.toUpperCase()] || 'method-get';
}

export function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'status-2xx';
  if (status >= 300 && status < 400) return 'status-3xx';
  if (status >= 400 && status < 500) return 'status-4xx';
  return 'status-5xx';
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function parseUrl(url: string): { baseUrl: string; params: Array<{ key: string; value: string }> } {
  try {
    const urlObj = new URL(url);
    const params: Array<{ key: string; value: string }> = [];
    urlObj.searchParams.forEach((value, key) => {
      params.push({ key, value });
    });
    return {
      baseUrl: `${urlObj.origin}${urlObj.pathname}`,
      params,
    };
  } catch {
    return { baseUrl: url, params: [] };
  }
}

export function buildUrl(baseUrl: string, params: Array<{ key: string; value: string; enabled: boolean }>): string {
  const enabledParams = params.filter(p => p.enabled && p.key);
  if (enabledParams.length === 0) return baseUrl;
  
  const queryString = enabledParams
    .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join('&');
  
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}${queryString}`;
}

export function tryParseJson(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

export function formatJson(str: string): string {
  const parsed = tryParseJson(str);
  if (parsed) {
    return JSON.stringify(parsed, null, 2);
  }
  return str;
}

export function minifyJson(str: string): string {
  const parsed = tryParseJson(str);
  if (parsed) {
    return JSON.stringify(parsed);
  }
  return str;
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => sortJsonValue(item));
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b, 'en')
    );
    const sorted: Record<string, unknown> = {};
    for (const [key, val] of entries) {
      sorted[key] = sortJsonValue(val);
    }
    return sorted;
  }
  return value;
}

export function sortJsonKeys(str: string): string {
  const parsed = tryParseJson(str);
  if (parsed) {
    const sorted = sortJsonValue(parsed);
    return JSON.stringify(sorted, null, 2);
  }
  return str;
}

export function minifyWhitespace(str: string): string {
  return str.replace(/\s+/gu, ' ').trim();
}

export function formatPlainText(str: string): string {
  return str
    .replace(/\r\n/gu, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();
}

export function sortLines(str: string): string {
  const lines = str
    .replace(/\r\n/gu, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  return lines.sort((a, b) => a.localeCompare(b, 'en')).join('\n');
}

export function formatGraphql(str: string): string {
  const cleaned = str.replace(/\r\n/gu, '\n').split('\n').map(line => line.trim()).filter(Boolean);
  let indent = 0;
  const formatted: string[] = [];
  for (const line of cleaned) {
    if (line.startsWith('}') || line.startsWith(']') || line.startsWith(')')) {
      indent = Math.max(indent - 1, 0);
    }
    formatted.push(`${'  '.repeat(indent)}${line}`);
    if (line.endsWith('{') || line.endsWith('(') || line.endsWith('[')) {
      indent += 1;
    }
  }
  return formatted.join('\n');
}

export function minifyGraphql(str: string): string {
  return str.replace(/#.*$/gmu, '').replace(/\s+/gu, ' ').trim();
}

export function estimateBytes(str: string): number {
  if (!str) {
    return 0;
  }
  return new TextEncoder().encode(str).length;
}

export function isJsonContentType(contentType: string): boolean {
  return contentType.includes('application/json') || contentType.includes('+json');
}

export function isHtmlContentType(contentType: string): boolean {
  return contentType.includes('text/html');
}

export function isXmlContentType(contentType: string): boolean {
  return contentType.includes('application/xml') || contentType.includes('text/xml') || contentType.includes('+xml');
}
