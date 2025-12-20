import React, { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger, ScrollArea, Button } from '@/components/ui';
import { StatusBadge } from './StatusBadge';
import { ResponseHeaders } from './ResponseHeaders';
import { ResponseBody } from './ResponseBody';
import { TestResults } from './TestResults';
import type { HttpResponse } from '@/types';
import { formatBytes, formatTime } from '@/lib/utils';
import { Copy, Download } from 'lucide-react';

interface ResponseViewerProps {
  response: HttpResponse;
}

export const ResponseViewer: React.FC<ResponseViewerProps> = ({ response }) => {
  const [bodyViewMode, setBodyViewMode] = useState<'pretty' | 'raw' | 'preview'>('pretty');
  
  const hasTests = useMemo(
    () => response.testResults && response.testResults.length > 0,
    [response.testResults]
  );

  const copyToClipboard = () => {
    navigator.clipboard.writeText(response.body);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Response content tabs with status in header */}
      <Tabs defaultValue="body" className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-tab-inactiveBackground)]">
          <TabsList className="bg-transparent border-none">
            <TabsTrigger value="body" className="data-[state=active]:bg-[var(--vscode-tab-activeBackground)]">
              Body
            </TabsTrigger>
            <TabsTrigger value="cookies" className="data-[state=active]:bg-[var(--vscode-tab-activeBackground)]">
              Cookies
            </TabsTrigger>
            <TabsTrigger value="headers" className="data-[state=active]:bg-[var(--vscode-tab-activeBackground)]">
              Headers ({Object.keys(response.headers).length})
            </TabsTrigger>
            {hasTests && (
              <TabsTrigger value="tests" className="data-[state=active]:bg-[var(--vscode-tab-activeBackground)]">
                Test Results
              </TabsTrigger>
            )}
          </TabsList>
          
          {/* Status info on the right */}
          <div className="flex items-center gap-3 text-sm">
            <StatusBadge status={response.status} statusText={response.statusText} />
            <span className="text-[var(--vscode-descriptionForeground)]">
              Time: <span className="text-[var(--vscode-foreground)]">{formatTime(response.time)}</span>
            </span>
            <span className="text-[var(--vscode-descriptionForeground)]">
              Size: <span className="text-[var(--vscode-foreground)]">{formatBytes(response.size)}</span>
            </span>
            <div className="flex items-center gap-1 border-l border-[var(--vscode-panel-border)] pl-2">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyToClipboard} title="Copy response">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Download response">
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <TabsContent value="body" className="flex-1 flex flex-col p-0 m-0 overflow-hidden">
          {/* Body view mode selector */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--vscode-panel-border)]">
            <div className="flex rounded overflow-hidden border border-[var(--vscode-input-border)]">
              {(['pretty', 'raw', 'preview'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setBodyViewMode(mode)}
                  className={`px-3 py-1 text-xs capitalize ${
                    bodyViewMode === mode
                      ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
                      : 'bg-[var(--vscode-input-background)] text-[var(--vscode-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <span className="text-xs text-[var(--vscode-descriptionForeground)] px-2 py-1 bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] rounded">
              {response.contentType?.split(';')[0] || 'text/plain'}
            </span>
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

