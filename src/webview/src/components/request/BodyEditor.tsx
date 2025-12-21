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

interface BodyEditorProps {
  body: RequestBody;
  onChange: (body: RequestBody) => void;
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

export const BodyEditor: React.FC<BodyEditorProps> = ({ body, onChange }) => {

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
            <div className="space-y-2">
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
            <textarea
              value={body.content}
              onChange={(e) => onChange({ ...body, content: e.target.value })}
              placeholder="query MyQuery {\n  viewer { id name }\n}\n"
              className="code-area w-full min-h-[200px]"
              spellCheck={false}
            />
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
