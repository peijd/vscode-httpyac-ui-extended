import * as httpyac from 'httpyac';
import type { HttpRequest, KeyValue, AuthConfig, RequestBody, HttpMethod } from './messageTypes';
import { v4 as uuidv4 } from 'uuid';

/**
 * Converts a webview HttpRequest to .http file content
 */
export function convertRequestToHttpContent(request: HttpRequest): string {
  const lines: string[] = [];

  // Add request name as comment if present
  if (request.name && request.name !== 'New Request') {
    lines.push(`# @name ${request.name}`);
  }

  // Add auth headers if needed
  const headers: KeyValue[] = [...request.headers];

  if (request.auth.type === 'basic' && request.auth.basic) {
    const credentials = Buffer.from(
      `${request.auth.basic.username}:${request.auth.basic.password}`
    ).toString('base64');
    headers.push({
      id: 'auth',
      key: 'Authorization',
      value: `Basic ${credentials}`,
      enabled: true,
    });
  } else if (request.auth.type === 'bearer' && request.auth.bearer) {
    headers.push({
      id: 'auth',
      key: 'Authorization',
      value: `Bearer ${request.auth.bearer.token}`,
      enabled: true,
    });
  } else if (request.auth.type === 'oauth2' && request.auth.oauth2) {
    // For OAuth2, add as metadata comment
    lines.push(`# @oauth2 ${request.auth.oauth2.grantType}`);
    lines.push(`# @tokenUrl ${request.auth.oauth2.tokenUrl}`);
    lines.push(`# @clientId ${request.auth.oauth2.clientId}`);
    if (request.auth.oauth2.scope) {
      lines.push(`# @scope ${request.auth.oauth2.scope}`);
    }
  }

  // Build URL with params
  let url = request.url;
  const enabledParams = request.params.filter(p => p.enabled && p.key);
  if (enabledParams.length > 0) {
    const queryString = enabledParams
      .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join('&');
    url += (url.includes('?') ? '&' : '?') + queryString;
  }

  // Request line
  lines.push(`${request.method} ${url}`);

  // Headers
  for (const header of headers.filter(h => h.enabled && h.key)) {
    lines.push(`${header.key}: ${header.value}`);
  }

  // Body
  if (request.body.type !== 'none') {
    lines.push(''); // Empty line before body

    if (request.body.type === 'json' || request.body.type === 'raw') {
      lines.push(request.body.content);
    } else if (request.body.type === 'form' || request.body.type === 'formdata') {
      const formData = request.body.formData || [];
      const formContent = formData
        .filter(f => f.enabled && f.key)
        .map(f => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`)
        .join('&');
      lines.push(formContent);
    }
  }

  // Add test script if present
  if (request.testScript) {
    lines.push('');
    lines.push('> {%');
    lines.push(request.testScript);
    lines.push('%}');
  }

  return lines.join('\n');
}

/**
 * Converts an httpyac HttpRegion to a webview HttpRequest
 */
export function convertHttpRegionToRequest(
  httpRegion: httpyac.HttpRegion
): HttpRequest | null {
  if (!httpRegion.request) {
    return null;
  }

  const request = httpRegion.request;
  const id = uuidv4();
  const name = httpRegion.symbol?.name || 'Request';

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

    if (contentType.includes('application/json')) {
      body.type = 'json';
      body.content = typeof request.body === 'string' 
        ? request.body 
        : JSON.stringify(request.body, null, 2);
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

  return {
    id,
    name,
    method,
    url,
    params,
    headers,
    auth,
    body,
  };
}

/**
 * Parses an .http file and returns an array of HttpRequests
 * This is a simplified parser - for full parsing, use the DocumentStore
 */
export async function parseHttpFile(
  content: string,
  _filePath: string
): Promise<HttpRequest[]> {
  // Simple regex-based parsing for basic requests
  // For full parsing, the webview should use the extension's DocumentStore
  const requests: HttpRequest[] = [];
  
  // Split by request separators (###)
  const sections = content.split(/^###/m);
  
  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;
    
    // Match request line: METHOD URL
    const requestLineMatch = trimmed.match(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(\S+)/m);
    if (!requestLineMatch) continue;
    
    const method = requestLineMatch[1] as HttpMethod;
    const url = requestLineMatch[2];
    
    // Extract name from @name comment (supports both "# @name XXX" and "@name XXX")
    const nameMatch = trimmed.match(/#?\s*@name\s+(.+?)(?:\n|$)/);
    let name: string;
    if (nameMatch) {
      name = nameMatch[1].trim();
    } else {
      // Use a friendly name from URL
      try {
        const urlObj = new URL(url.startsWith('http') ? url : `http://localhost${url}`);
        name = urlObj.pathname || url;
      } catch {
        name = url.length > 50 ? url.substring(0, 50) + '...' : url;
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
        if (line.match(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+/)) {
          foundRequestLine = true;
        }
        continue;
      }
      
      if (!line) {
        bodyStartIndex = i + 1;
        break;
      }
      if (line.startsWith('#') || line.startsWith('@')) continue;
      
      const headerMatch = line.match(/^([^:]+):\s*(.*)$/);
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
      bodyContent = bodyContent.replace(/>\s*{%[\s\S]*?%}/g, '').trim();
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
