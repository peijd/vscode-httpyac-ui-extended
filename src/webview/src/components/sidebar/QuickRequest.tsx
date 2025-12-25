import React, { useMemo } from 'react';
import { UrlBar } from '@/components/request';
import { useStore, useVsCodeMessages } from '@/hooks';
import { buildPreviewVariables, resolveTemplatePreview } from '@/lib/variablePreview';

export const QuickRequest: React.FC = () => {
  const { currentRequest, isLoading, setMethod, setUrl, environmentSnapshot, activeEnvironments } = useStore();
  const { sendRequest, openInEditor } = useVsCodeMessages();
  const previewVariables = useMemo(
    () => (environmentSnapshot ? buildPreviewVariables(environmentSnapshot, activeEnvironments) : undefined),
    [environmentSnapshot, activeEnvironments]
  );
  const urlPreview = useMemo(() => {
    if (!previewVariables) {
      return resolveTemplatePreview('', {});
    }
    return resolveTemplatePreview(currentRequest.url || '', previewVariables);
  }, [currentRequest.url, previewVariables]);

  const handleSend = () => {
    if (currentRequest.url) {
      sendRequest();
    }
  };

  return (
    <div className="p-3 border-b border-vscode-border">
      <h2 className="section-header mb-3">Quick Request</h2>
      <div className="space-y-2">
        <UrlBar
          method={currentRequest.method}
          url={currentRequest.url}
          isLoading={isLoading}
          onMethodChange={setMethod}
          onUrlChange={setUrl}
          onSend={handleSend}
          className="flex-wrap"
          preview={urlPreview}
        />
        <button
          className="text-xs text-vscode-link hover:underline"
          onClick={() => openInEditor(currentRequest)}
        >
          Open in editor for more options →
        </button>
      </div>
    </div>
  );
};
