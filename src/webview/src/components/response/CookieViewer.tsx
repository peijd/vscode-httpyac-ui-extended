import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui';
import { Copy, Cookie } from 'lucide-react';

export interface ParsedCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  maxAge?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  raw: string;
}

interface CookieViewerProps {
  headers: Record<string, string>;
}

/**
 * Parse a Set-Cookie header string into a structured cookie object
 */
function parseSetCookie(cookieStr: string): ParsedCookie | null {
  if (!cookieStr) return null;

  const parts = cookieStr.split(';').map((p) => p.trim());
  if (parts.length === 0) return null;

  // First part is name=value
  const [firstPart, ...attributes] = parts;
  const eqIndex = firstPart.indexOf('=');
  if (eqIndex === -1) return null;

  const name = firstPart.slice(0, eqIndex).trim();
  const value = firstPart.slice(eqIndex + 1).trim();

  const cookie: ParsedCookie = {
    name,
    value,
    raw: cookieStr,
  };

  // Parse attributes
  for (const attr of attributes) {
    const attrLower = attr.toLowerCase();
    if (attrLower === 'httponly') {
      cookie.httpOnly = true;
    } else if (attrLower === 'secure') {
      cookie.secure = true;
    } else if (attrLower.startsWith('domain=')) {
      cookie.domain = attr.slice(7);
    } else if (attrLower.startsWith('path=')) {
      cookie.path = attr.slice(5);
    } else if (attrLower.startsWith('expires=')) {
      cookie.expires = attr.slice(8);
    } else if (attrLower.startsWith('max-age=')) {
      cookie.maxAge = attr.slice(8);
    } else if (attrLower.startsWith('samesite=')) {
      cookie.sameSite = attr.slice(9);
    }
  }

  return cookie;
}

/**
 * Extract all Set-Cookie headers from response headers
 */
export function extractCookies(headers: Record<string, string>): ParsedCookie[] {
  const cookies: ParsedCookie[] = [];

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'set-cookie') {
      // Handle both single and multiple cookies
      // Note: In HTTP/2, multiple cookies might be in separate headers or comma-separated
      const cookieStrings = value.includes('\n') ? value.split('\n') : [value];
      for (const cookieStr of cookieStrings) {
        const parsed = parseSetCookie(cookieStr.trim());
        if (parsed) {
          cookies.push(parsed);
        }
      }
    }
  }

  return cookies;
}

export const CookieViewer: React.FC<CookieViewerProps> = ({ headers }) => {
  const [copyFeedback, setCopyFeedback] = useState('');
  const cookies = useMemo(() => extractCookies(headers), [headers]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(`${label} copied`);
    setTimeout(() => setCopyFeedback(''), 2000);
  };

  const handleCopyAll = () => {
    const allCookies = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    handleCopy(allCookies, 'All cookies');
  };

  if (cookies.length === 0) {
    return (
      <div className="p-4 text-center text-[var(--vscode-descriptionForeground)]">
        <Cookie className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <div className="text-sm">No cookies in response</div>
        <div className="text-xs opacity-70 mt-1">
          Cookies will appear here when the server sends Set-Cookie headers
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-editorWidget-background)]">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--vscode-descriptionForeground)]">
            {cookies.length} cookie{cookies.length !== 1 ? 's' : ''}
          </span>
          {copyFeedback && (
            <span className="text-xs text-[var(--vscode-descriptionForeground)]">
              {copyFeedback}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1"
          onClick={handleCopyAll}
        >
          <Copy className="h-3.5 w-3.5" />
          Copy All
        </Button>
      </div>

      {/* Cookie table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[var(--vscode-editorWidget-background)]">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-[var(--vscode-descriptionForeground)] border-b border-[var(--vscode-panel-border)]">
                Name
              </th>
              <th className="text-left px-4 py-2 font-medium text-[var(--vscode-descriptionForeground)] border-b border-[var(--vscode-panel-border)]">
                Value
              </th>
              <th className="text-left px-4 py-2 font-medium text-[var(--vscode-descriptionForeground)] border-b border-[var(--vscode-panel-border)]">
                Domain
              </th>
              <th className="text-left px-4 py-2 font-medium text-[var(--vscode-descriptionForeground)] border-b border-[var(--vscode-panel-border)]">
                Path
              </th>
              <th className="text-left px-4 py-2 font-medium text-[var(--vscode-descriptionForeground)] border-b border-[var(--vscode-panel-border)]">
                Expires
              </th>
              <th className="text-center px-2 py-2 font-medium text-[var(--vscode-descriptionForeground)] border-b border-[var(--vscode-panel-border)]">
                Flags
              </th>
              <th className="w-10 border-b border-[var(--vscode-panel-border)]"></th>
            </tr>
          </thead>
          <tbody>
            {cookies.map((cookie, index) => (
              <tr
                key={`${cookie.name}-${index}`}
                className="hover:bg-[var(--vscode-list-hoverBackground)] group"
              >
                <td className="px-4 py-2 font-medium text-[var(--vscode-foreground)] border-b border-[var(--vscode-panel-border)]">
                  {cookie.name}
                </td>
                <td
                  className="px-4 py-2 text-[var(--vscode-descriptionForeground)] border-b border-[var(--vscode-panel-border)] max-w-[200px] truncate"
                  title={cookie.value}
                >
                  {cookie.value}
                </td>
                <td className="px-4 py-2 text-[var(--vscode-descriptionForeground)] border-b border-[var(--vscode-panel-border)]">
                  {cookie.domain || '-'}
                </td>
                <td className="px-4 py-2 text-[var(--vscode-descriptionForeground)] border-b border-[var(--vscode-panel-border)]">
                  {cookie.path || '-'}
                </td>
                <td className="px-4 py-2 text-[var(--vscode-descriptionForeground)] border-b border-[var(--vscode-panel-border)]">
                  {cookie.expires || cookie.maxAge ? `${cookie.maxAge || ''}s` : 'Session'}
                </td>
                <td className="px-2 py-2 text-center border-b border-[var(--vscode-panel-border)]">
                  <div className="flex items-center justify-center gap-1">
                    {cookie.httpOnly && (
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]"
                        title="HttpOnly"
                      >
                        H
                      </span>
                    )}
                    {cookie.secure && (
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]"
                        title="Secure"
                      >
                        S
                      </span>
                    )}
                    {cookie.sameSite && (
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]"
                        title={`SameSite=${cookie.sameSite}`}
                      >
                        {cookie.sameSite.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 border-b border-[var(--vscode-panel-border)]">
                  <button
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--vscode-toolbar-hoverBackground)] transition-opacity"
                    onClick={() => handleCopy(`${cookie.name}=${cookie.value}`, cookie.name)}
                    title="Copy cookie"
                  >
                    <Copy className="h-3 w-3 text-[var(--vscode-descriptionForeground)]" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
