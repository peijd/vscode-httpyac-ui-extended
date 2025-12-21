import React, { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger, Button } from '@/components/ui';
import { KeyValueEditor } from './KeyValueEditor';
import type { RequestBody, KeyValue, BodyType } from '@/types';
import { useStore, createKeyValue } from '@/hooks';
import { formatJson, tryParseJson } from '@/lib/utils';
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

  const handleFormat = () => {
    onChange({ ...body, content: formattedJson });
  };

  const handleTypeChange = (type: BodyType) => {
    onChange({ ...body, type });
    
    // Auto-set Content-Type header
    switch (type) {
      case 'json':
        updateHeaders('application/json');
        break;
      case 'form':
        updateHeaders('application/x-www-form-urlencoded');
        break;
      case 'formdata':
        updateHeaders('multipart/form-data');
        break;
      case 'graphql':
        updateHeaders('application/graphql');
        break;
      case 'ndjson':
        updateHeaders('application/x-ndjson');
        break;
      case 'xml':
        updateHeaders('application/xml');
        break;
      case 'binary':
        updateHeaders('application/octet-stream');
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
                JSON 高亮编辑
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                  onClick={handleFormat}
                  >
                    格式化
                  </Button>
                  <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">
                    {jsonValid ? 'JSON 可解析' : 'JSON 无效'}
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
                {errorInfo.line ? `第 ${errorInfo.line} 行，第 ${errorInfo.column ?? 1} 列：` : ''}
                {errorInfo.message}
              </div>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="form">
          <KeyValueEditor
            items={body.formData || []}
            onAdd={handleFormDataAdd}
            onUpdate={handleFormDataUpdate}
            onRemove={handleFormDataRemove}
            keyPlaceholder="Field name"
            valuePlaceholder="Field value"
          />
        </TabsContent>

        <TabsContent value="formdata">
          <KeyValueEditor
            items={body.formData || []}
            onAdd={handleFormDataAdd}
            onUpdate={handleFormDataUpdate}
            onRemove={handleFormDataRemove}
            keyPlaceholder="Field name"
            valuePlaceholder="Field value"
          />
        </TabsContent>

        <TabsContent value="raw">
          <textarea
            value={body.content}
            onChange={(e) => onChange({ ...body, content: e.target.value })}
            placeholder="Raw body content..."
            className="code-area w-full min-h-[200px]"
            spellCheck={false}
          />
        </TabsContent>

        <TabsContent value="graphql">
          <textarea
            value={body.content}
            onChange={(e) => onChange({ ...body, content: e.target.value })}
            placeholder="query MyQuery {\n  viewer { id name }\n}\n"
            className="code-area w-full min-h-[200px]"
            spellCheck={false}
          />
        </TabsContent>

        <TabsContent value="ndjson">
          <textarea
            value={body.content}
            onChange={(e) => onChange({ ...body, content: e.target.value })}
            placeholder='{"id":1}\n{"id":2}\n'
            className="code-area w-full min-h-[200px]"
            spellCheck={false}
          />
        </TabsContent>

        <TabsContent value="xml">
          <textarea
            value={body.content}
            onChange={(e) => onChange({ ...body, content: e.target.value })}
            placeholder="<root>\n  <item>value</item>\n</root>"
            className="code-area w-full min-h-[200px]"
            spellCheck={false}
          />
        </TabsContent>

        <TabsContent value="binary">
          <div className="space-y-2">
            <input
              value={body.binaryPath || ''}
              onChange={(e) => onChange({ ...body, binaryPath: e.target.value })}
              placeholder="输入文件路径（将以 @path 写入请求体）"
              className="w-full px-3 py-2 bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded text-sm"
            />
            <p className="text-xs text-[var(--vscode-descriptionForeground)]">
              可用于发送二进制或文件内容；路径会被序列化为 @path。
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
