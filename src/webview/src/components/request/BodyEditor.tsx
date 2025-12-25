import React, { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger, Button } from '@/components/ui';
import { KeyValueEditor } from './KeyValueEditor';
import type { RequestBody, KeyValue, BodyType } from '@/types';
import { useStore, createKeyValue } from '@/hooks';
import {
  estimateBytes,
  formatBytes,
  formatGraphql,
  formatJson,
  formatPlainText,
  minifyGraphql,
  minifyJson,
  minifyWhitespace,
  sortJsonKeys,
  sortLines,
  tryParseJson,
} from '@/lib/utils';
import { CodeEditor } from '@/components/common/CodeEditor';
import { resolveTemplatePreview, truncatePreview } from '@/lib/variablePreview';

interface BodyEditorProps {
  body: RequestBody;
  onChange: (body: RequestBody) => void;
  previewVariables?: Record<string, string>;
}

const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'form', label: 'Form URL' },
  { value: 'formdata', label: 'Form Data' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'ndjson', label: 'NDJSON' },
  { value: 'xml', label: 'XML' },
  { value: 'raw', label: 'Raw' },
  { value: 'binary', label: 'Binary/File' },
];

export const BodyEditor: React.FC<BodyEditorProps> = ({ body, onChange, previewVariables }) => {

  const updateHeaders = (contentType: string) => {
    const { currentRequest, updateHeader, addHeader } = useStore.getState();
    const existingHeader = currentRequest.headers.find(
      (h) => h.key.toLowerCase() === 'content-type'
    );
    if (existingHeader) {
      updateHeader(existingHeader.id, { value: contentType });
    } else if (contentType) {
      addHeader();
      // Get the newly added header and update it
      const state = useStore.getState();
      const newHeader = state.currentRequest.headers[state.currentRequest.headers.length - 1];
      if (newHeader) {
        updateHeader(newHeader.id, { key: 'Content-Type', value: contentType });
      }
    }
  };

  const ensureHeader = (key: string, value: string) => {
    const { currentRequest, updateHeader, addHeader } = useStore.getState();
    const existingHeader = currentRequest.headers.find(
      (h) => h.key.toLowerCase() === key.toLowerCase()
    );
    if (existingHeader) {
      if (!existingHeader.value) {
        updateHeader(existingHeader.id, { value });
      }
      return;
    }
    if (!value) {
      return;
    }
    addHeader();
    const state = useStore.getState();
    const newHeader = state.currentRequest.headers[state.currentRequest.headers.length - 1];
    if (newHeader) {
      updateHeader(newHeader.id, { key, value });
    }
  };

  const formattedJson = useMemo(() => formatJson(body.content || ''), [body.content]);
  const jsonValid = useMemo(() => tryParseJson(body.content || '') !== null, [body.content]);
  const rawJson = body.content || '';
  const errorInfo = useMemo(() => {
    const trimmed = rawJson.trim();
    if (!trimmed) {
      return null;
    }
    try {
      JSON.parse(rawJson);
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON';
      const match = message.match(/position\s+(\d+)/iu);
      const position = match ? Number(match[1]) : null;
      if (position === null || Number.isNaN(position)) {
        return { line: null, column: null, message };
      }
      let line = 1;
      let column = 1;
      for (let i = 0; i < rawJson.length && i < position; i += 1) {
        if (rawJson[i] === '\n') {
          line += 1;
          column = 1;
        } else {
          column += 1;
        }
      }
      return { line, column, message };
    }
  }, [rawJson]);

  const bodySize = useMemo(() => {
    switch (body.type) {
      case 'form':
      case 'formdata': {
        const content = (body.formData || [])
          .filter(item => item.enabled && item.key)
          .map(item => `${item.key}=${item.value}`)
          .join('&');
        return estimateBytes(content);
      }
      case 'binary':
        return 0;
      default:
        return estimateBytes(body.content || '');
    }
  }, [body]);

  const bodyPreview = useMemo(() => {
    if (!previewVariables) {
      return null;
    }
    return resolveTemplatePreview(body.content || '', previewVariables);
  }, [body.content, previewVariables]);

  const renderPreview = (label: string) => {
    if (!bodyPreview || !bodyPreview.hasTemplate) {
      return null;
    }
    const previewText = truncatePreview(bodyPreview.resolved);
    return (
      <div className="mt-2 text-[10px] text-[var(--vscode-descriptionForeground)]">
        <div className="flex items-center gap-2">
          <span className="ui-chip">{label} Preview</span>
          {previewText.truncated ? (
            <span className="ui-chip">Truncated</span>
          ) : null}
        </div>
        <pre className="mt-1 max-h-40 overflow-auto rounded bg-[var(--vscode-editor-background)] p-2 text-[11px]">
          {previewText.text}
        </pre>
        {bodyPreview.missing.length > 0 ? (
          <div className="mt-1 text-[var(--vscode-errorForeground)]">
            Missing: {bodyPreview.missing.join(', ')}
          </div>
        ) : null}
        {bodyPreview.dynamic.length > 0 ? (
          <div className="mt-1">Dynamic: {bodyPreview.dynamic.join(', ')}</div>
        ) : null}
      </div>
    );
  };

  const renderPreviewPanel = (label: string) => {
    const hasTemplate = bodyPreview?.hasTemplate;
    const missingCount = bodyPreview?.missing.length || 0;
    const dynamicCount = bodyPreview?.dynamic.length || 0;
    const used = bodyPreview?.used || [];
    const previewMap = previewVariables || {};
    return (
      <div className="w-72 shrink-0 flex flex-col gap-3 min-h-0">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
            {label} Preview
          </div>
          <div className="flex items-center gap-1">
            {missingCount > 0 ? (
              <span className="ui-chip text-[10px] text-[var(--vscode-errorForeground)]">Missing {missingCount}</span>
            ) : null}
            {dynamicCount > 0 ? (
              <span className="ui-chip text-[10px]">Dynamic {dynamicCount}</span>
            ) : null}
          </div>
        </div>
        <div className="ui-card p-2 flex-1 min-h-0 text-[10px] text-[var(--vscode-descriptionForeground)]">
          {hasTemplate && used.length > 0 ? (
            <div className="h-full max-h-[320px] overflow-auto rounded bg-[var(--vscode-editor-background)] p-2 text-[11px] space-y-1">
              {used.map((name) => {
                const isMissing = bodyPreview?.missing.includes(name);
                const isDynamic = bodyPreview?.dynamic.includes(name);
                const rawValue = previewMap[name];
                const value =
                  isDynamic ? 'Dynamic variable' : isMissing ? 'Undefined' : rawValue ?? '';
                const display = value.length > 120 ? `${value.slice(0, 120)}…` : value;
                return (
                  <div key={name} className="flex items-start gap-2">
                    <span className="ui-chip shrink-0">{name}</span>
                    <span
                      className={
                        isMissing
                          ? 'text-[var(--vscode-errorForeground)]'
                          : 'text-[var(--vscode-foreground)]'
                      }
                    >
                      {display || '""'}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-[var(--vscode-descriptionForeground)]">
              No variable placeholders detected
            </div>
          )}
        </div>
        <div className="ui-card p-3 text-[10px] text-[var(--vscode-descriptionForeground)] space-y-1">
          <div>Preview uses the current environment + runtime variables only.</div>
          <div>Dynamic variables are not replaced; they are only marked.</div>
        </div>
      </div>
    );
  };

  const handleFormat = () => {
    onChange({ ...body, content: formattedJson });
  };

  const handleMinifyJson = () => {
    onChange({ ...body, content: minifyJson(body.content || '') });
  };

  const handleSortJson = () => {
    onChange({ ...body, content: sortJsonKeys(body.content || '') });
  };

  const handleFormatGraphql = () => {
    onChange({ ...body, content: formatGraphql(body.content || '') });
  };

  const handleMinifyGraphql = () => {
    onChange({ ...body, content: minifyGraphql(body.content || '') });
  };

  const handleSortGraphql = () => {
    onChange({ ...body, content: sortLines(body.content || '') });
  };

  const handleFormatRaw = () => {
    onChange({ ...body, content: formatPlainText(body.content || '') });
  };

  const handleMinifyRaw = () => {
    onChange({ ...body, content: minifyWhitespace(body.content || '') });
  };

  const handleSortRaw = () => {
    onChange({ ...body, content: sortLines(body.content || '') });
  };

  const handleTypeChange = (type: BodyType) => {
    onChange({ ...body, type });
    
    // Auto-set Content-Type header
    switch (type) {
      case 'json':
        updateHeaders('application/json');
        ensureHeader('Accept', 'application/json');
        break;
      case 'form':
        updateHeaders('application/x-www-form-urlencoded');
        ensureHeader('Accept', '*/*');
        break;
      case 'formdata':
        updateHeaders('multipart/form-data');
        ensureHeader('Accept', '*/*');
        break;
      case 'graphql':
        updateHeaders('application/graphql');
        ensureHeader('Accept', 'application/graphql');
        break;
      case 'ndjson':
        updateHeaders('application/x-ndjson');
        ensureHeader('Accept', 'application/x-ndjson');
        break;
      case 'xml':
        updateHeaders('application/xml');
        ensureHeader('Accept', 'application/xml');
        break;
      case 'binary':
        updateHeaders('application/octet-stream');
        ensureHeader('Accept', '*/*');
        break;
      case 'raw':
        ensureHeader('Accept', '*/*');
        break;
      default:
        break;
    }
  };

  const handleFormDataAdd = () => {
    const newFormData = [...(body.formData || []), createKeyValue()];
    onChange({ ...body, formData: newFormData });
  };

  const handleFormDataUpdate = (id: string, updates: Partial<KeyValue>) => {
    const newFormData = (body.formData || []).map((item) =>
      item.id === id ? { ...item, ...updates } : item
    );
    onChange({ ...body, formData: newFormData });
  };

  const handleFormDataRemove = (id: string) => {
    const newFormData = (body.formData || []).filter((item) => item.id !== id);
    onChange({ ...body, formData: newFormData });
  };

  return (
    <div className="space-y-3">
      <Tabs value={body.type} onValueChange={(v) => handleTypeChange(v as BodyType)}>
        <TabsList className="pro-tabs border-b-0">
          {BODY_TYPES.map(({ value, label }) => (
            <TabsTrigger key={value} value={value} className="pro-tab">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="none">
          <p className="text-sm text-[var(--vscode-descriptionForeground)]">
            This request does not have a body
          </p>
        </TabsContent>

        <TabsContent value="json">
          <div className="flex gap-4 min-h-0">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs text-[var(--vscode-descriptionForeground)]">
                  JSON editor
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={handleFormat}
                    >
                      Format
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={handleMinifyJson}
                    >
                      Minify
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={handleSortJson}
                    >
                      Sort
                    </Button>
                  </div>
                  <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">
                    Size {formatBytes(bodySize)}
                  </span>
                  <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">
                    {jsonValid ? 'Valid JSON' : 'Invalid JSON'}
                  </span>
                  <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">
                    {navigator.platform.toLowerCase().includes('mac') ? '⌘⇧F' : 'Ctrl+Shift+F'}
                  </span>
                </div>
              </div>
              <CodeEditor
                value={body.content}
                language="json"
                placeholder='{\n  "key": "value"\n}'
                onChange={(value) => onChange({ ...body, content: value })}
                onFormat={handleFormat}
                minHeight={300}
                maxHeight={420}
              />
              {errorInfo ? (
                <div className="text-xs text-[var(--vscode-errorForeground)]">
                  {errorInfo.line ? `Line ${errorInfo.line}, Col ${errorInfo.column ?? 1}: ` : ''}
                  {errorInfo.message}
                </div>
              ) : null}
            </div>
            {renderPreviewPanel('JSON')}
          </div>
        </TabsContent>

        <TabsContent value="form">
          <div className="space-y-2">
            <KeyValueEditor
              items={body.formData || []}
              onAdd={handleFormDataAdd}
              onUpdate={handleFormDataUpdate}
              onRemove={handleFormDataRemove}
              onItemsChange={(items) => onChange({ ...body, formData: items })}
              keyPlaceholder="Field name"
              valuePlaceholder="Field value"
              previewVariables={previewVariables}
            />
            <div className="text-[10px] text-[var(--vscode-descriptionForeground)]">
              Size {formatBytes(bodySize)}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="formdata">
          <div className="space-y-2">
            <KeyValueEditor
              items={body.formData || []}
              onAdd={handleFormDataAdd}
              onUpdate={handleFormDataUpdate}
              onRemove={handleFormDataRemove}
              onItemsChange={(items) => onChange({ ...body, formData: items })}
              keyPlaceholder="Field name"
              valuePlaceholder="Field value"
              previewVariables={previewVariables}
            />
            <div className="text-[10px] text-[var(--vscode-descriptionForeground)]">
              Size {formatBytes(bodySize)}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="raw">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-[var(--vscode-descriptionForeground)]">Raw input</div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={handleFormatRaw}
                  >
                    Format
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={handleMinifyRaw}
                  >
                    Minify
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={handleSortRaw}
                  >
                    Sort
                  </Button>
                </div>
                <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">
                  Size {formatBytes(bodySize)}
                </span>
              </div>
            </div>
            <textarea
              value={body.content}
              onChange={(e) => onChange({ ...body, content: e.target.value })}
              placeholder="Raw body content..."
              className="code-area w-full min-h-[200px]"
              spellCheck={false}
            />
            {renderPreview('Raw')}
          </div>
        </TabsContent>

        <TabsContent value="graphql">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-[var(--vscode-descriptionForeground)]">GraphQL query</div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={handleFormatGraphql}
                  >
                    Format
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={handleMinifyGraphql}
                  >
                    Minify
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={handleSortGraphql}
                  >
                    Sort
                  </Button>
                </div>
                <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">
                  Size {formatBytes(bodySize)}
                </span>
              </div>
            </div>
            <CodeEditor
              value={body.content}
              onChange={(value) => onChange({ ...body, content: value })}
              placeholder="query MyQuery {\n  viewer { id name }\n}\n"
              language="graphql"
              minHeight={220}
              maxHeight={420}
            />
            {renderPreview('GraphQL')}
          </div>
        </TabsContent>

        <TabsContent value="ndjson">
          <textarea
            value={body.content}
            onChange={(e) => onChange({ ...body, content: e.target.value })}
            placeholder='{"id":1}\n{"id":2}\n'
            className="code-area w-full min-h-[200px]"
            spellCheck={false}
          />
          {renderPreview('NDJSON')}
          <div className="mt-2 text-[10px] text-[var(--vscode-descriptionForeground)]">
            Size {formatBytes(bodySize)}
          </div>
        </TabsContent>

        <TabsContent value="xml">
          <textarea
            value={body.content}
            onChange={(e) => onChange({ ...body, content: e.target.value })}
            placeholder="<root>\n  <item>value</item>\n</root>"
            className="code-area w-full min-h-[200px]"
            spellCheck={false}
          />
          {renderPreview('XML')}
          <div className="mt-2 text-[10px] text-[var(--vscode-descriptionForeground)]">
            Size {formatBytes(bodySize)}
          </div>
        </TabsContent>

        <TabsContent value="binary">
          <div className="space-y-2">
            <input
              value={body.binaryPath || ''}
              onChange={(e) => onChange({ ...body, binaryPath: e.target.value })}
              placeholder="Enter file path (will be serialized as @path)"
              className="w-full px-3 py-2 bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded text-sm"
            />
            <p className="text-xs text-[var(--vscode-descriptionForeground)]">
              Use to send binary/file content; the path will be serialized as @path.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
