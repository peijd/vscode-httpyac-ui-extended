import * as httpyac from 'httpyac';
import { createHash } from 'crypto';
import type { HttpRequest, KeyValue, AuthConfig, RequestBody, HttpMethod } from '../webview-bridge/messageTypes';
import { v4 as uuidv4 } from 'uuid';

const REQUEST_LINE_REGEX = /^\s*(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)\s+\S+/iu;
const BODY_HASH_SNIPPET = 160;

function isScriptStartLine(line: string): boolean {
  return line.trim() === '> {%';
}

function isScriptEndLine(line: string): boolean {
  return line.trim() === '%}';
}

function getMetaText(metaData: httpyac.HttpRegion['metaData'], key: string): string | undefined {
  const value = metaData?.[key];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return undefined;
}

export function getHttpRegionDisplayName(httpRegion: httpyac.HttpRegion): string {
  return (
    getMetaText(httpRegion.metaData, 'title') ||
    getMetaText(httpRegion.metaData, 'name') ||
    httpRegion.symbol?.name?.trim() ||
    'Request'
  );
}

function normalizeMetaKey(key: string): string {
  return key.startsWith('@') ? key.slice(1) : key;
}

function buildMetaLines(meta: KeyValue[] | undefined): string[] {
  if (!meta || meta.length === 0) {
    return [];
  }
  return meta
    .filter(item => item.enabled && item.key)
    .map(item => {
      const key = normalizeMetaKey(item.key.trim());
      const value = item.value?.trim();
      return value ? `# @${key} ${value}` : `# @${key}`;
    });
}

function buildScriptBlock(script: string | undefined): string[] {
  const content = script?.trimEnd();
  if (!content) {
    return [];
  }
  const lines = content.split(/\r?\n/u);
  return ['> {%', ...lines, '%}'];
}

function buildUrlWithParams(request: HttpRequest): string {
  let url = request.url || '';
  const enabledParams = request.params.filter(p => p.enabled && p.key);
  if (enabledParams.length > 0) {
    const queryString = enabledParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
    url += (url.includes('?') ? '&' : '?') + queryString;
  }
  return url;
}

function buildHeaders(request: HttpRequest): Record<string, unknown> {
  const headers: Record<string, unknown> = {};
  const addHeader = (key: string, value: string) => {
    if (headers[key]) {
      const current = headers[key];
      if (Array.isArray(current)) {
        current.push(value);
      } else {
        headers[key] = [current as string, value];
      }
    } else {
      headers[key] = value;
    }
  };

  for (const header of request.headers.filter(h => h.enabled && h.key)) {
    addHeader(header.key, header.value);
  }

  if (request.auth.type === 'basic' && request.auth.basic) {
    const credentials = Buffer.from(`${request.auth.basic.username}:${request.auth.basic.password}`).toString('base64');
    addHeader('Authorization', `Basic ${credentials}`);
  } else if (request.auth.type === 'bearer' && request.auth.bearer) {
    addHeader('Authorization', `Bearer ${request.auth.bearer.token}`);
  }

  return headers;
}

function buildBodyContent(body: RequestBody): string | undefined {
  if (body.type === 'none') {
    return undefined;
  }
  if ((body.type === 'form' || body.type === 'formdata') && body.formData) {
    return body.formData
      .filter(f => f.enabled && f.key)
      .map(f => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`)
      .join('&');
  }
  if (body.type === 'binary' && body.binaryPath) {
    const path = body.binaryPath.startsWith('@') ? body.binaryPath.slice(1) : body.binaryPath;
    return `@${path}`;
  }
  return body.content || '';
}

function buildHttpyacRequest(request: HttpRequest): httpyac.Request {
  return {
    method: request.method,
    url: buildUrlWithParams(request),
    headers: buildHeaders(request),
    body: buildBodyContent(request.body),
  };
}

function summarizeBody(body: string): string {
  const normalized = body.replace(/\r\n/gu, '\n').trim();
  if (!normalized) {
    return '';
  }
  if (normalized.length <= BODY_HASH_SNIPPET * 2) {
    return `len=${normalized.length}\n${normalized}`;
  }
  const head = normalized.slice(0, BODY_HASH_SNIPPET);
  const tail = normalized.slice(-BODY_HASH_SNIPPET);
  return `len=${normalized.length}\n${head}\n...\n${tail}`;
}

function hashText(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function formatHeadersForHash(headers: Record<string, unknown> | undefined): string {
  if (!headers) {
    return '';
  }
  const normalized = new Map<string, string[]>();
  for (const [key, value] of Object.entries(headers)) {
    const name = key.trim().toLowerCase();
    if (!name) {
      continue;
    }
    let values: string[] = [];
    if (Array.isArray(value)) {
      values = value.map(item => String(item).trim());
    } else if (value !== undefined && value !== null) {
      values = [String(value).trim()];
    }
    const existing = normalized.get(name) || [];
    normalized.set(name, [...existing, ...values].filter(Boolean));
  }
  return Array.from(normalized.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => `${key}:${values.sort().join(',')}`)
    .join('\n');
}

function getRequestBodyAsString(body: unknown): string {
  if (typeof body === 'string') {
    return body;
  }
  if (body instanceof Buffer) {
    return body.toString('utf-8');
  }
  if (body && typeof body === 'object') {
    return JSON.stringify(body, null, 2);
  }
  if (body !== undefined && body !== null) {
    return String(body);
  }
  return '';
}

export function computeRequestSourceHash(request: HttpRequest): string {
  const url = buildUrlWithParams(request);
  const headers = buildHeaders(request);
  const body = buildBodyContent(request.body) || '';
  const payload = [`${request.method.toUpperCase()} ${url}`, formatHeadersForHash(headers), summarizeBody(body)].join(
    '\n'
  );
  return hashText(payload);
}

export function computeHttpRegionSourceHash(httpRegion: httpyac.HttpRegion): string | undefined {
  if (!httpRegion.request) {
    return undefined;
  }
  const method = httpRegion.request.method?.toUpperCase() || 'GET';
  const url =
    typeof httpRegion.request.url === 'string' ? httpRegion.request.url : String(httpRegion.request.url || '');
  const headers = httpRegion.request.headers || undefined;
  const body = getRequestBodyAsString(httpRegion.request.body);
  const payload = [`${method} ${url}`, formatHeadersForHash(headers), summarizeBody(body)].join('\n');
  return hashText(payload);
}

function findRequestLineIndex(lines: string[]): number {
  return lines.findIndex(line => REQUEST_LINE_REGEX.test(line));
}

function extractScriptsFromSource(source: string | undefined): { preRequestScript?: string; testScript?: string } {
  if (!source) {
    return {};
  }
  const lines = source.split(/\r?\n/u);
  const requestLineIndex = findRequestLineIndex(lines);
  if (requestLineIndex === -1) {
    return {};
  }

  const blocks: Array<{ start: number; end: number; content: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    if (isScriptStartLine(lines[i] || '')) {
      let end = i + 1;
      const contentLines: string[] = [];
      for (; end < lines.length; end++) {
        if (isScriptEndLine(lines[end] || '')) {
          break;
        }
        contentLines.push(lines[end]);
      }
      blocks.push({ start: i, end, content: contentLines.join('\n') });
      i = end;
    }
  }

  const preBlocks = blocks.filter(block => block.start < requestLineIndex).map(block => block.content.trim());
  const testBlocks = blocks.filter(block => block.start > requestLineIndex).map(block => block.content.trim());

  return {
    preRequestScript: preBlocks.filter(Boolean).join('\n\n') || undefined,
    testScript: testBlocks.filter(Boolean).join('\n\n') || undefined,
  };
}

/**
 * Converts a webview HttpRequest to .http file content
 */
export function convertRequestToHttpContent(request: HttpRequest): string {
  const lines: string[] = [];

  const metaLines = buildMetaLines(request.meta);
  lines.push(...metaLines);

  if (request.auth.type === 'oauth2' && request.auth.oauth2) {
    const hasMeta = (key: string) =>
      (request.meta || []).some(item => item.enabled && normalizeMetaKey(item.key).toLowerCase() === key.toLowerCase());
    if (!hasMeta('oauth2')) {
      lines.push(`# @oauth2 ${request.auth.oauth2.grantType}`);
    }
    if (!hasMeta('tokenUrl')) {
      lines.push(`# @tokenUrl ${request.auth.oauth2.tokenUrl}`);
    }
    if (!hasMeta('clientId')) {
      lines.push(`# @clientId ${request.auth.oauth2.clientId}`);
    }
    if (request.auth.oauth2.scope && !hasMeta('scope')) {
      lines.push(`# @scope ${request.auth.oauth2.scope}`);
    }
  }

  lines.push(...buildScriptBlock(request.preRequestScript));

  const httpRequestLines = httpyac.utils.toHttpStringRequest(buildHttpyacRequest(request), {
    body: request.body.type !== 'none',
  });
  lines.push(...httpRequestLines);

  lines.push(...buildScriptBlock(request.testScript));

  return lines.join('\n');
}

/**
 * Converts an httpyac HttpRegion to a webview HttpRequest
 */
export function convertHttpRegionToRequest(httpRegion: httpyac.HttpRegion): HttpRequest | null {
  if (!httpRegion.request) {
    return null;
  }

  const request = httpRegion.request;
  const id = uuidv4();
  const name = getHttpRegionDisplayName(httpRegion);

  // Parse method
  const method = (request.method?.toUpperCase() || 'GET') as HttpMethod;

  // Parse URL
  let url = '';
  if (typeof request.url === 'string') {
    url = request.url;
  }

  // Parse headers
  const headers: KeyValue[] = [];
  if (request.headers) {
    for (const [key, value] of Object.entries(request.headers)) {
      const headerValue = Array.isArray(value) ? value.join(', ') : String(value);
      headers.push({
        id: uuidv4(),
        key,
        value: headerValue,
        enabled: true,
      });
    }
  }

  // Parse auth from headers
  const auth: AuthConfig = { type: 'none' };
  const authHeader = headers.find(h => h.key.toLowerCase() === 'authorization');
  if (authHeader) {
    if (authHeader.value.startsWith('Basic ')) {
      try {
        const decoded = Buffer.from(authHeader.value.slice(6), 'base64').toString();
        const [username, password] = decoded.split(':');
        auth.type = 'basic';
        auth.basic = { username, password: password || '' };
        // Remove auth header as it will be added back
        const index = headers.indexOf(authHeader);
        if (index > -1) {
          headers.splice(index, 1);
        }
      } catch {
        // Keep as-is if decode fails
      }
    } else if (authHeader.value.startsWith('Bearer ')) {
      auth.type = 'bearer';
      auth.bearer = { token: authHeader.value.slice(7) };
      const index = headers.indexOf(authHeader);
      if (index > -1) {
        headers.splice(index, 1);
      }
    }
  }

  // Parse body
  const body: RequestBody = { type: 'none', content: '' };
  if (request.body) {
    const contentTypeHeader = headers.find(h => h.key.toLowerCase() === 'content-type');
    const contentType = contentTypeHeader?.value || '';

    if (contentType.includes('application/graphql')) {
      body.type = 'graphql';
      body.content = String(request.body);
    } else if (contentType.includes('application/x-ndjson') || contentType.includes('application/ndjson')) {
      body.type = 'ndjson';
      body.content = String(request.body);
    } else if (
      contentType.includes('application/xml') ||
      contentType.includes('text/xml') ||
      contentType.includes('+xml')
    ) {
      body.type = 'xml';
      body.content = String(request.body);
    } else if (contentType.includes('application/json')) {
      body.type = 'json';
      body.content = typeof request.body === 'string' ? request.body : JSON.stringify(request.body, null, 2);
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      body.type = 'form';
      body.content = String(request.body);
      // Parse form data into key-value pairs
      try {
        const params = new URLSearchParams(String(request.body));
        body.formData = [];
        params.forEach((value, key) => {
          body.formData!.push({
            id: uuidv4(),
            key,
            value,
            enabled: true,
          });
        });
      } catch {
        // Keep as raw content
      }
    } else if (contentType.includes('multipart/form-data')) {
      body.type = 'formdata';
      body.content = String(request.body);
    } else {
      body.type = 'raw';
      body.content = String(request.body);
    }
  }

  // Parse params from URL
  const params: KeyValue[] = [];
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.forEach((value, key) => {
      params.push({
        id: uuidv4(),
        key,
        value,
        enabled: true,
      });
    });
    // Update URL to remove query params as they're now in params
    url = `${urlObj.origin}${urlObj.pathname}`;
  } catch {
    // URL parsing failed, keep original URL
  }

  const meta: KeyValue[] = Object.entries(httpRegion.metaData || {})
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ({
      id: uuidv4(),
      key,
      value: value === true ? '' : String(value),
      enabled: true,
    }));

  const scripts = extractScriptsFromSource(httpRegion.symbol.source);

  return {
    id,
    name,
    method,
    url,
    params,
    headers,
    meta,
    auth,
    body,
    preRequestScript: scripts.preRequestScript,
    testScript: scripts.testScript,
  };
}

/**
 * Parses an .http file and returns an array of HttpRequests
 * This is a simplified parser - for full parsing, use the DocumentStore
 */
export async function parseHttpFile(content: string, _filePath: string): Promise<HttpRequest[]> {
  void _filePath;
  // Simple regex-based parsing for basic requests
  // For full parsing, the webview should use the extension's DocumentStore
  const requests: HttpRequest[] = [];

  // Split by request separators (###)
  const sections = content.split(/^###/mu);

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    // Match request line: METHOD URL
    const requestLineMatch = trimmed.match(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(\S+)/mu);
    if (!requestLineMatch) continue;

    const method = requestLineMatch[1] as HttpMethod;
    const url = requestLineMatch[2];

    // Extract name from @name comment (supports both "# @name XXX" and "@name XXX")
    const nameMatch = trimmed.match(/#?\s*@name\s+(.+?)(?:\n|$)/u);
    let name: string;
    if (nameMatch) {
      name = nameMatch[1].trim();
    } else {
      // Use a friendly name from URL
      try {
        const urlObj = new URL(url.startsWith('http') ? url : `http://localhost${url}`);
        name = urlObj.pathname || url;
      } catch {
        name = url.length > 50 ? `${url.slice(0, 50)}...` : url;
      }
    }

    // Parse headers (lines after request line, before empty line)
    const headers: KeyValue[] = [];
    const lines = trimmed.split('\n');
    let bodyStartIndex = -1;
    let foundRequestLine = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip comments and empty lines before request line
      if (!foundRequestLine) {
        if (line.match(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+/u)) {
          foundRequestLine = true;
        }
        continue;
      }

      if (!line) {
        bodyStartIndex = i + 1;
        break;
      }
      if (line.startsWith('#') || line.startsWith('@')) continue;

      const headerMatch = line.match(/^([^:]+):\s*(.*)$/u);
      if (headerMatch) {
        headers.push({
          id: uuidv4(),
          key: headerMatch[1].trim(),
          value: headerMatch[2].trim(),
          enabled: true,
        });
      }
    }

    // Extract body
    let bodyContent = '';
    if (bodyStartIndex > 0 && bodyStartIndex < lines.length) {
      bodyContent = lines.slice(bodyStartIndex).join('\n').trim();
      // Remove script blocks
      bodyContent = bodyContent.replace(/>\s*\{%\s*[\s\S]*?%\}/gu, '').trim();
    }

    // Determine body type from content-type header
    const contentTypeHeader = headers.find(h => h.key.toLowerCase() === 'content-type');
    const contentType = contentTypeHeader?.value || '';

    let bodyType: RequestBody['type'] = 'none';
    if (bodyContent) {
      if (contentType.includes('application/json')) {
        bodyType = 'json';
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        bodyType = 'form';
      } else {
        bodyType = 'raw';
      }
    }

    requests.push({
      id: uuidv4(),
      name,
      method,
      url,
      params: [],
      headers,
      auth: { type: 'none' },
      body: { type: bodyType, content: bodyContent },
    });
  }

  return requests;
}
