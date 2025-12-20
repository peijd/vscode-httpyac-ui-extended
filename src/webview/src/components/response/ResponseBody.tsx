import React, { useMemo } from 'react';
import { formatJson, isJsonContentType, isHtmlContentType } from '@/lib/utils';

interface ResponseBodyProps {
  body: string;
  contentType: string;
  viewMode?: 'pretty' | 'raw' | 'preview';
}

export const ResponseBody: React.FC<ResponseBodyProps> = ({ body, contentType, viewMode = 'pretty' }) => {
  const formattedBody = useMemo(() => {
    if (viewMode === 'raw') {
      return body;
    }
    if (isJsonContentType(contentType)) {
      return formatJson(body);
    }
    return body;
  }, [body, contentType, viewMode]);

  if (!body) {
    return (
      <div className="p-4 text-[var(--vscode-descriptionForeground)]">
        No response body
      </div>
    );
  }

  const isJson = isJsonContentType(contentType);
  const isHtml = isHtmlContentType(contentType);

  // Preview mode for HTML
  if (viewMode === 'preview' && isHtml) {
    return (
      <iframe
        srcDoc={body}
        className="w-full h-full border-none bg-white"
        sandbox="allow-same-origin"
        title="HTML Preview"
      />
    );
  }

  // Pretty or Raw mode
  return (
    <div className="p-4">
      <pre className="font-mono text-sm whitespace-pre-wrap break-all">
        {isJson && viewMode === 'pretty' ? (
          <JsonHighlighter json={formattedBody} />
        ) : (
          <code>{formattedBody}</code>
        )}
      </pre>
    </div>
  );
};

// Simple JSON syntax highlighter
const JsonHighlighter: React.FC<{ json: string }> = ({ json }) => {
  const lines = json.split('\n');
  
  return (
    <code className="block">
      {lines.map((line, i) => (
        <div key={i} className="flex">
          <span className="select-none text-[var(--vscode-editorLineNumber-foreground)] pr-4 text-right w-8 shrink-0">
            {i + 1}
          </span>
          <span className="flex-1">
            {highlightJsonLine(line)}
          </span>
        </div>
      ))}
    </code>
  );
};

function highlightJsonLine(line: string): React.ReactNode {
  // Simple regex-based highlighting
  const parts: React.ReactNode[] = [];
  let remaining = line;
  let key = 0;

  // Match strings (keys and values)
  const stringRegex = /"([^"\\]|\\.)*"/g;
  let match;
  let lastIndex = 0;

  while ((match = stringRegex.exec(remaining)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      const before = remaining.slice(lastIndex, match.index);
      parts.push(
        <span key={key++}>
          {highlightNonString(before)}
        </span>
      );
    }
    
    // Check if it's a key (followed by :)
    const afterMatch = remaining.slice(match.index + match[0].length);
    const isKey = afterMatch.trimStart().startsWith(':');
    
    parts.push(
      <span 
        key={key++} 
        className={isKey ? 'text-[var(--vscode-symbolIcon-propertyForeground)]' : 'text-[var(--vscode-symbolIcon-stringForeground)]'}
      >
        {match[0]}
      </span>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < remaining.length) {
    parts.push(
      <span key={key++}>
        {highlightNonString(remaining.slice(lastIndex))}
      </span>
    );
  }
  
  return parts.length > 0 ? parts : line;
}

function highlightNonString(text: string): React.ReactNode {
  // Highlight numbers, booleans, null
  return text.split(/(\b(?:true|false|null|\d+(?:\.\d+)?)\b)/g).map((part, i) => {
    if (/^(true|false)$/.test(part)) {
      return <span key={i} className="text-[var(--vscode-symbolIcon-booleanForeground)]">{part}</span>;
    }
    if (/^null$/.test(part)) {
      return <span key={i} className="text-[var(--vscode-symbolIcon-nullForeground)]">{part}</span>;
    }
    if (/^\d+(?:\.\d+)?$/.test(part)) {
      return <span key={i} className="text-[var(--vscode-symbolIcon-numberForeground)]">{part}</span>;
    }
    return part;
  });
}

