import React, { useMemo } from 'react';
import { formatJson, isJsonContentType, isHtmlContentType, tryParseJson } from '@/lib/utils';
import { CodeEditor } from '@/components/common/CodeEditor';

interface ResponseBodyProps {
  body: string;
  contentType: string;
  viewMode?: 'structured' | 'raw' | 'preview' | 'pretty' | 'tree';
}

export const ResponseBody: React.FC<ResponseBodyProps> = ({ body, contentType, viewMode = 'structured' }) => {
  const normalizedView: 'structured' | 'raw' | 'preview' =
    viewMode === 'pretty' || viewMode === 'tree' ? 'structured' : viewMode;
  const formattedBody = useMemo(() => {
    if (normalizedView === 'raw') {
      return body;
    }
    if (isJsonContentType(contentType)) {
      return formatJson(body);
    }
    return body;
  }, [body, contentType, normalizedView]);

  const parsedJson = useMemo(() => {
    if (!isJsonContentType(contentType)) {
      return null;
    }
    return tryParseJson(body);
  }, [body, contentType]);

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
  if (normalizedView === 'preview' && isHtml) {
    return (
      <iframe
        srcDoc={body}
        className="w-full h-full border-none bg-white"
        sandbox="allow-same-origin"
        title="HTML Preview"
      />
    );
  }

  if (normalizedView === 'structured' && isJson) {
    if (parsedJson === null) {
      return (
        <div className="p-4 text-[var(--vscode-descriptionForeground)] text-sm">
          Failed to parse JSON. Structured view is unavailable.
        </div>
      );
    }
    return (
      <div className="p-4">
        <JsonTree data={parsedJson} depth={0} />
      </div>
    );
  }

  if (normalizedView === 'structured') {
    return (
      <div className="p-4">
        <CodeEditor
          value={formattedBody}
          language={isJson ? 'json' : 'text'}
          readOnly
          minHeight={240}
          maxHeight={520}
        />
      </div>
    );
  }

  // Raw mode
  return (
    <div className="p-4">
      <pre className="font-mono text-sm whitespace-pre overflow-x-auto">
        <code>{formattedBody}</code>
      </pre>
    </div>
  );
};

const JsonTree: React.FC<{ data: unknown; depth: number }> = ({ data, depth }) => {
  if (data === null) {
    return <span className="text-[var(--vscode-symbolIcon-nullForeground)]">null</span>;
  }
  if (typeof data === 'string') {
    return <span className="text-[var(--vscode-symbolIcon-stringForeground)]">"{data}"</span>;
  }
  if (typeof data === 'number') {
    return <span className="text-[var(--vscode-symbolIcon-numberForeground)]">{data}</span>;
  }
  if (typeof data === 'boolean') {
    return <span className="text-[var(--vscode-symbolIcon-booleanForeground)]">{String(data)}</span>;
  }
  if (Array.isArray(data)) {
    const label = `Array(${data.length})`;
    return (
      <details open={depth < 1} className="ml-2">
        <summary className="cursor-pointer text-[var(--vscode-foreground)]">{label}</summary>
        <div className="pl-4 space-y-1">
          {data.map((item, index) => (
            <div key={index} className="flex gap-2">
              <span className="text-[var(--vscode-descriptionForeground)]">{index}:</span>
              <JsonTree data={item} depth={depth + 1} />
            </div>
          ))}
        </div>
      </details>
    );
  }
  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    const label = `Object(${entries.length})`;
    return (
      <details open={depth < 1} className="ml-2">
        <summary className="cursor-pointer text-[var(--vscode-foreground)]">{label}</summary>
        <div className="pl-4 space-y-1">
          {entries.map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <span className="text-[var(--vscode-symbolIcon-propertyForeground)]">{key}:</span>
              <JsonTree data={value} depth={depth + 1} />
            </div>
          ))}
        </div>
      </details>
    );
  }
  return <span>{String(data)}</span>;
};
