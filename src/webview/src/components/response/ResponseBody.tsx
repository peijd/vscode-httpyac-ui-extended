import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { formatJson, isJsonContentType, isHtmlContentType, tryParseJson } from '@/lib/utils';
import { CodeEditor } from '@/components/common/CodeEditor';
import { Button } from '@/components/ui';
import { ChevronRight, ChevronDown, Copy, Search, Expand, Shrink } from 'lucide-react';

interface ResponseBodyProps {
  body: string;
  contentType: string;
  viewMode?: 'structured' | 'raw' | 'preview' | 'pretty' | 'tree';
  onSaveVariable?: (payload: { name: string; value: string; path: string }) => void;
}

export const ResponseBody: React.FC<ResponseBodyProps> = ({
  body,
  contentType,
  viewMode = 'structured',
  onSaveVariable,
}) => {
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
    return <JsonTreeViewer data={parsedJson} onSaveVariable={onSaveVariable} />;
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

// JSON Tree Viewer with toolbar
const JsonTreeViewer: React.FC<{ data: unknown; onSaveVariable?: ResponseBodyProps['onSaveVariable'] }> = ({
  data,
  onSaveVariable,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandAll, setExpandAll] = useState(false);
  const [expandKey, setExpandKey] = useState(0);
  const [copyFeedback, setCopyFeedback] = useState('');

  const handleExpandAll = () => {
    setExpandAll(true);
    setExpandKey(prev => prev + 1);
  };

  const handleCollapseAll = () => {
    setExpandAll(false);
    setExpandKey(prev => prev + 1);
  };

  const handleCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path);
    setCopyFeedback(`Copied: ${path}`);
    setTimeout(() => setCopyFeedback(''), 2000);
  }, []);

  const handleCopyValue = useCallback((value: unknown) => {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    navigator.clipboard.writeText(text);
    setCopyFeedback('Value copied');
    setTimeout(() => setCopyFeedback(''), 2000);
  }, []);

  const handleSaveVariable = useCallback(
    (path: string, value: unknown) => {
      if (!onSaveVariable) {
        return;
      }
      const rawName = path
        .replace(/^\$\./u, '')
        .replace(/^\$/u, '')
        .replace(/\[(\d+)\]/gu, '_$1')
        .replace(/[^\w]+/gu, '_')
        .replace(/^_+/u, '')
        .replace(/_+$/u, '');
      const suggested = rawName || 'value';
      const name = window.prompt('Save as variable name', suggested);
      if (!name) {
        return;
      }
      let normalizedValue = '';
      if (typeof value === 'string') {
        normalizedValue = value;
      } else if (value === null || value === undefined) {
        normalizedValue = String(value);
      } else {
        normalizedValue = JSON.stringify(value, null, 2);
      }
      onSaveVariable({ name, value: normalizedValue, path });
      setCopyFeedback(`Saved: ${name}`);
      setTimeout(() => setCopyFeedback(''), 2000);
    },
    [onSaveVariable]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-editorWidget-background)]">
        <div className="flex items-center gap-1 flex-1">
          <Search className="h-3.5 w-3.5 text-[var(--vscode-input-placeholderForeground)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search keys or values..."
            className="flex-1 max-w-[240px] px-2 py-1 text-xs bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={handleExpandAll}
            title="Expand all"
          >
            <Expand className="h-3.5 w-3.5" />
            Expand
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={handleCollapseAll}
            title="Collapse all"
          >
            <Shrink className="h-3.5 w-3.5" />
            Collapse
          </Button>
        </div>
        {copyFeedback && (
          <span className="text-xs text-[var(--vscode-descriptionForeground)]">{copyFeedback}</span>
        )}
      </div>
      {/* Tree content */}
      <div className="flex-1 overflow-auto p-4">
        <JsonTreeNode
          key={expandKey}
          data={data}
          path="$"
          depth={0}
          searchQuery={searchQuery.toLowerCase()}
          forceExpand={expandAll}
          onCopyPath={handleCopyPath}
          onCopyValue={handleCopyValue}
          onSaveVariable={handleSaveVariable}
        />
      </div>
    </div>
  );
};

// Single JSON Tree Node
interface JsonTreeNodeProps {
  data: unknown;
  path: string;
  depth: number;
  searchQuery: string;
  forceExpand: boolean;
  onCopyPath: (path: string) => void;
  onCopyValue: (value: unknown) => void;
  onSaveVariable?: (path: string, value: unknown) => void;
  keyName?: string;
  isArrayIndex?: boolean;
}

const JsonTreeNode: React.FC<JsonTreeNodeProps> = ({
  data,
  path,
  depth,
  searchQuery,
  forceExpand,
  onCopyPath,
  onCopyValue,
  onSaveVariable,
}) => {
  const [isExpanded, setIsExpanded] = useState(forceExpand || depth < 2);
  const nodeRef = useRef<HTMLDivElement>(null);

  // Update expansion state when forceExpand changes
  useEffect(() => {
    setIsExpanded(forceExpand || depth < 2);
  }, [forceExpand, depth]);

  const matchesSearch = useCallback((text: string) => {
    if (!searchQuery) return false;
    return text.toLowerCase().includes(searchQuery);
  }, [searchQuery]);

  const highlightMatch = useCallback((text: string) => {
    if (!searchQuery || !matchesSearch(text)) return text;
    const index = text.toLowerCase().indexOf(searchQuery);
    if (index === -1) return text;
    return (
      <>
        {text.slice(0, index)}
        <mark className="bg-[var(--vscode-editor-findMatchHighlightBackground)] text-[var(--vscode-editor-findMatchHighlightForeground)] rounded-sm px-0.5">
          {text.slice(index, index + searchQuery.length)}
        </mark>
        {text.slice(index + searchQuery.length)}
      </>
    );
  }, [searchQuery, matchesSearch]);

  // Render primitive values
  if (data === null) {
    return (
      <span className="group inline-flex items-center gap-1">
        <span className="json-value json-null">null</span>
        {onSaveVariable ? (
          <button
            className="json-copy-btn opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--vscode-toolbar-hoverBackground)]"
            onClick={(event) => {
              event.stopPropagation();
              onSaveVariable(path, null);
            }}
            title="Save as variable"
          >
            <Copy className="h-3 w-3 text-[var(--vscode-descriptionForeground)]" />
          </button>
        ) : null}
      </span>
    );
  }

  if (typeof data === 'undefined') {
    return (
      <span className="group inline-flex items-center gap-1">
        <span className="json-value json-undefined">undefined</span>
        {onSaveVariable ? (
          <button
            className="json-copy-btn opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--vscode-toolbar-hoverBackground)]"
            onClick={(event) => {
              event.stopPropagation();
              onSaveVariable(path, undefined);
            }}
            title="Save as variable"
          >
            <Copy className="h-3 w-3 text-[var(--vscode-descriptionForeground)]" />
          </button>
        ) : null}
      </span>
    );
  }

  if (typeof data === 'string') {
    const displayValue = `"${data}"`;
    const isMatch = matchesSearch(data);
    return (
      <span className="group inline-flex items-center gap-1">
        <span className={`json-value json-string ${isMatch ? 'json-match' : ''}`}>
          {highlightMatch(displayValue)}
        </span>
        {onSaveVariable ? (
          <button
            className="json-copy-btn opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--vscode-toolbar-hoverBackground)]"
            onClick={(event) => {
              event.stopPropagation();
              onSaveVariable(path, data);
            }}
            title="Save as variable"
          >
            <Copy className="h-3 w-3 text-[var(--vscode-descriptionForeground)]" />
          </button>
        ) : null}
      </span>
    );
  }

  if (typeof data === 'number') {
    const displayValue = String(data);
    const isMatch = matchesSearch(displayValue);
    return (
      <span className="group inline-flex items-center gap-1">
        <span className={`json-value json-number ${isMatch ? 'json-match' : ''}`}>
          {highlightMatch(displayValue)}
        </span>
        {onSaveVariable ? (
          <button
            className="json-copy-btn opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--vscode-toolbar-hoverBackground)]"
            onClick={(event) => {
              event.stopPropagation();
              onSaveVariable(path, data);
            }}
            title="Save as variable"
          >
            <Copy className="h-3 w-3 text-[var(--vscode-descriptionForeground)]" />
          </button>
        ) : null}
      </span>
    );
  }

  if (typeof data === 'boolean') {
    return (
      <span className="group inline-flex items-center gap-1">
        <span className="json-value json-boolean">{String(data)}</span>
        {onSaveVariable ? (
          <button
            className="json-copy-btn opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--vscode-toolbar-hoverBackground)]"
            onClick={(event) => {
              event.stopPropagation();
              onSaveVariable(path, data);
            }}
            title="Save as variable"
          >
            <Copy className="h-3 w-3 text-[var(--vscode-descriptionForeground)]" />
          </button>
        ) : null}
      </span>
    );
  }

  // Handle arrays and objects
  const isArray = Array.isArray(data);
  const entries = isArray
    ? data.map((item, index) => [index, item] as [number, unknown])
    : Object.entries(data as Record<string, unknown>);
  const count = entries.length;
  const typeLabel = isArray ? `Array(${count})` : `Object`;
  const bracketOpen = isArray ? '[' : '{';
  const bracketClose = isArray ? ']' : '}';

  // Check if any children match search
  const hasMatchingChild = useCallback(() => {
    if (!searchQuery) return false;
    const checkMatch = (obj: unknown): boolean => {
      if (obj === null || obj === undefined) return false;
      if (typeof obj === 'string') return obj.toLowerCase().includes(searchQuery);
      if (typeof obj === 'number') return String(obj).toLowerCase().includes(searchQuery);
      if (Array.isArray(obj)) return obj.some(checkMatch);
      if (typeof obj === 'object') {
        return Object.entries(obj as Record<string, unknown>).some(
          ([key, val]) => key.toLowerCase().includes(searchQuery) || checkMatch(val)
        );
      }
      return false;
    };
    return checkMatch(data);
  }, [data, searchQuery]);

  // Auto-expand if search matches children
  useEffect(() => {
    if (searchQuery && hasMatchingChild()) {
      setIsExpanded(true);
    }
  }, [searchQuery, hasMatchingChild]);

  return (
    <div ref={nodeRef} className="json-node">
      <div
        className="json-node-header group flex items-center gap-1 cursor-pointer hover:bg-[var(--vscode-list-hoverBackground)] rounded px-1 -mx-1"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="json-chevron w-4 h-4 flex items-center justify-center">
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 text-[var(--vscode-descriptionForeground)]" />
          ) : (
            <ChevronRight className="h-3 w-3 text-[var(--vscode-descriptionForeground)]" />
          )}
        </span>
        <span className="json-type-label text-[var(--vscode-descriptionForeground)] text-xs">
          {typeLabel}
        </span>
        <span className="json-bracket text-[var(--vscode-foreground)]">{bracketOpen}</span>
        {!isExpanded && count > 0 && (
          <span className="text-[var(--vscode-descriptionForeground)] text-xs">...</span>
        )}
        {!isExpanded && (
          <span className="json-bracket text-[var(--vscode-foreground)]">{bracketClose}</span>
        )}
        {/* Copy buttons */}
        <button
          className="json-copy-btn opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded hover:bg-[var(--vscode-toolbar-hoverBackground)]"
          onClick={(e) => {
            e.stopPropagation();
            onCopyPath(path);
          }}
          title={`Copy path: ${path}`}
        >
          <Copy className="h-3 w-3 text-[var(--vscode-descriptionForeground)]" />
        </button>
        <button
          className="json-copy-btn opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--vscode-toolbar-hoverBackground)]"
          onClick={(e) => {
            e.stopPropagation();
            onCopyValue(data);
          }}
          title="Copy value"
        >
          <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">JSON</span>
        </button>
        {onSaveVariable ? (
          <button
            className="json-copy-btn opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--vscode-toolbar-hoverBackground)]"
            onClick={(e) => {
              e.stopPropagation();
              onSaveVariable(path, data);
            }}
            title="Save as variable"
          >
            <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">VAR</span>
          </button>
        ) : null}
      </div>
      {isExpanded && count > 0 && (
        <div className="json-children pl-4 border-l border-[var(--vscode-editorIndentGuide-background)] ml-2">
          {entries.map(([key, value]) => {
            const childPath = isArray ? `${path}[${key}]` : `${path}.${key}`;
            const keyStr = String(key);
            const keyMatches = matchesSearch(keyStr);
            return (
              <div key={keyStr} className="json-entry flex items-start gap-1 py-0.5">
                <span
                  className={`json-key cursor-pointer hover:underline ${keyMatches ? 'json-match' : ''}`}
                  onClick={() => onCopyPath(childPath)}
                  title={`Click to copy: ${childPath}`}
                >
                  {isArray ? (
                    <span className="text-[var(--vscode-descriptionForeground)]">
                      {highlightMatch(keyStr)}
                    </span>
                  ) : (
                    <span className="json-property-key">
                      {highlightMatch(keyStr)}
                    </span>
                  )}
                  <span className="text-[var(--vscode-foreground)]">:</span>
                </span>
                <JsonTreeNode
                  data={value}
                  path={childPath}
                  depth={depth + 1}
                  searchQuery={searchQuery}
                  forceExpand={forceExpand}
                  onCopyPath={onCopyPath}
                  onCopyValue={onCopyValue}
                  onSaveVariable={onSaveVariable}
                  keyName={keyStr}
                  isArrayIndex={isArray}
                />
              </div>
            );
          })}
          <span className="json-bracket text-[var(--vscode-foreground)]">{bracketClose}</span>
        </div>
      )}
    </div>
  );
};
