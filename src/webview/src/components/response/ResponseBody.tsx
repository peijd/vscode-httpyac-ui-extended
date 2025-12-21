import React, { useMemo } from 'react';
import { formatJson, isJsonContentType, isHtmlContentType, tryParseJson } from '@/lib/utils';
import { CodeEditor } from '@/components/common/CodeEditor';

interface ResponseBodyProps {
  body: string;
  contentType: string;
  viewMode?: 'pretty' | 'raw' | 'preview' | 'tree';
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

  if (viewMode === 'pretty' && isJson) {
    if (parsedJson === null) {
      return (
        <div className="p-4 text-[var(--vscode-descriptionForeground)] text-sm">
          JSON 解析失败，无法折叠展示。
        </div>
      );
    }
    return (
      <div className="p-4">
        <JsonTree data={parsedJson} depth={0} />
      </div>
    );
  }

  // Code or Raw mode
  return (
    <div className="p-4">
      {viewMode === 'tree' ? (
        <CodeEditor
          value={formattedBody}
          language={isJson ? 'json' : 'text'}
          readOnly
          minHeight={240}
          maxHeight={520}
        />
      ) : (
        <pre className="font-mono text-sm whitespace-pre overflow-x-auto">
          <code>{formattedBody}</code>
        </pre>
      )}
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
