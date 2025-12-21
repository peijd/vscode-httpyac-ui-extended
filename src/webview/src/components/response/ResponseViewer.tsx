import React, { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger, ScrollArea, Button } from '@/components/ui';
import { StatusBadge } from './StatusBadge';
import { ResponseHeaders } from './ResponseHeaders';
import { ResponseBody } from './ResponseBody';
import { TestResults } from './TestResults';
import type { HttpResponse, HttpRequest } from '@/types';
import { formatBytes, formatTime } from '@/lib/utils';
import { Copy, FileDown, ClipboardList, Clipboard } from 'lucide-react';

interface ResponseViewerProps {
  response: HttpResponse;
  request?: HttpRequest;
  onSaveSnippet?: () => void;
}

export const ResponseViewer: React.FC<ResponseViewerProps> = ({ response, request, onSaveSnippet }) => {
  const [bodyViewMode, setBodyViewMode] = useState<'pretty' | 'raw' | 'preview' | 'tree'>('pretty');
  const [copyFeedback, setCopyFeedback] = useState('');
  
  const hasTests = useMemo(
    () => response.testResults && response.testResults.length > 0,
    [response.testResults]
  );

  const showCopyFeedback = (label: string) => {
    setCopyFeedback(label);
    window.setTimeout(() => setCopyFeedback(''), 1500);
  };

  const copyBody = () => {
    navigator.clipboard.writeText(response.body || '');
    showCopyFeedback('已复制 Body');
  };

  const copyHeaders = () => {
    const headerText = Object.entries(response.headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    navigator.clipboard.writeText(headerText);
    showCopyFeedback('已复制 Headers');
  };

  const copyAll = () => {
    const headerText = Object.entries(response.headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    const content = `${headerText}\n\n${response.body || ''}`.trim();
    navigator.clipboard.writeText(content);
    showCopyFeedback('已复制全部');
  };

  const saveSnippet = () => {
    if (request && onSaveSnippet) {
      onSaveSnippet();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Response content tabs with status in header */}
      <Tabs defaultValue="body" className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-tab-inactiveBackground)]">
          <TabsList className="pro-tabs bg-transparent border-none border-b-0">
            <TabsTrigger value="body" className="pro-tab">
              Body
            </TabsTrigger>
            <TabsTrigger value="cookies" className="pro-tab">
              Cookies
            </TabsTrigger>
            <TabsTrigger value="headers" className="pro-tab">
              Headers ({Object.keys(response.headers).length})
            </TabsTrigger>
            {hasTests && (
              <TabsTrigger value="tests" className="pro-tab">
                Test Results
              </TabsTrigger>
            )}
          </TabsList>
          
          {/* Status info on the right */}
          <div className="flex items-center gap-3 text-sm">
            <StatusBadge status={response.status} statusText={response.statusText} />
            <span className="ui-chip">
              {formatTime(response.time)}
            </span>
            <span className="ui-chip">
              {formatBytes(response.size)}
            </span>
            <div className="flex items-center gap-1 pl-2">
              <Button variant="ghost" size="icon" className="h-7 w-7 ui-hover" onClick={copyBody} title="Copy body">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 ui-hover" onClick={copyHeaders} title="Copy headers">
                <ClipboardList className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 ui-hover" onClick={copyAll} title="Copy headers + body">
                <Clipboard className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 ui-hover"
                onClick={saveSnippet}
                disabled={!request || !onSaveSnippet}
                title={request && onSaveSnippet ? '保存为 .http 片段' : '无可用请求'}
              >
                <FileDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <TabsContent value="body" className="flex-1 flex flex-col p-0 m-0 overflow-hidden">
          {/* Body view mode selector */}
          <div className="ui-subbar flex items-center gap-2 px-3 py-2">
            <div className="flex rounded overflow-hidden border border-[var(--vscode-input-border)]">
              {([
                { value: 'pretty', label: 'pretty' },
                { value: 'tree', label: 'code' },
                { value: 'raw', label: 'raw' },
                { value: 'preview', label: 'preview' },
              ] as const).map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setBodyViewMode(mode.value)}
                  className={`px-3 py-1 text-xs capitalize ${
                    bodyViewMode === mode.value
                      ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
                      : 'bg-[var(--vscode-input-background)] text-[var(--vscode-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <span className="ui-chip">
              {response.contentType?.split(';')[0] || 'text/plain'}
            </span>
            {copyFeedback ? (
              <span className="ui-chip">{copyFeedback}</span>
            ) : null}
          </div>
          <ScrollArea className="flex-1">
            <ResponseBody body={response.body} contentType={response.contentType} viewMode={bodyViewMode} />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="cookies" className="flex-1 p-4 m-0 overflow-auto">
          <div className="text-sm text-[var(--vscode-descriptionForeground)]">
            No cookies in response
          </div>
        </TabsContent>

        <TabsContent value="headers" className="flex-1 p-0 m-0 overflow-hidden">
          <ScrollArea className="h-full">
            <ResponseHeaders headers={response.headers} />
          </ScrollArea>
        </TabsContent>

        {hasTests && (
          <TabsContent value="tests" className="flex-1 p-0 m-0 overflow-hidden">
            <ScrollArea className="h-full">
              <TestResults results={response.testResults || []} />
            </ScrollArea>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
