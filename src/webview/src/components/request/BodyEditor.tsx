import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { KeyValueEditor } from './KeyValueEditor';
import type { RequestBody, KeyValue, BodyType } from '@/types';
import { useStore, createKeyValue } from '@/hooks';

interface BodyEditorProps {
  body: RequestBody;
  onChange: (body: RequestBody) => void;
}

const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'form', label: 'Form URL' },
  { value: 'formdata', label: 'Form Data' },
  { value: 'raw', label: 'Raw' },
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
        <TabsList>
          {BODY_TYPES.map(({ value, label }) => (
            <TabsTrigger key={value} value={value}>
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
          <textarea
            value={body.content}
            onChange={(e) => onChange({ ...body, content: e.target.value })}
            placeholder='{\n  "key": "value"\n}'
            className="code-area w-full min-h-[200px]"
            spellCheck={false}
          />
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
      </Tabs>
    </div>
  );
};

