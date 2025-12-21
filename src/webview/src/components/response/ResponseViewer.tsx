import React, { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger, ScrollArea, Button } from '@/components/ui';
import { StatusBadge } from './StatusBadge';
import { ResponseHeaders } from './ResponseHeaders';
import { ResponseBody } from './ResponseBody';
import { TestResults } from './TestResults';
import type { HttpResponse, HttpRequest } from '@/types';
import { formatBytes, formatTime } from '@/lib/utils';
import { Copy, FileDown, FilePlus, ClipboardList, Clipboard } from 'lucide-react';

interface ResponseViewerProps {
  response: HttpResponse;
  request?: HttpRequest;
  onSaveSnippet?: () => void;
  onAppendSnippet?: () => void;
}

const LARGE_RESPONSE_BYTES = 2 * 1024 * 1024;

export const ResponseViewer: React.FC<ResponseViewerProps> = ({ response, request, onSaveSnippet, onAppendSnippet }) => {
  const [bodyViewMode, setBodyViewMode] = useState<'structured' | 'raw' | 'preview'>('structured');
  const [copyFeedback, setCopyFeedback] = useState('');
  const [summaryOnly, setSummaryOnly] = useState(false);
  const [headerPrefix, setHeaderPrefix] = useState('');
  
  const hasTests = useMemo(
    () => response.testResults && response.testResults.length > 0,
    [response.testResults]
  );
  const isLargeResponse = response.size >= LARGE_RESPONSE_BYTES;
  const totalHeaders = Object.keys(response.headers).length;
  const filteredHeaders = useMemo(() => {
    const normalizedPrefix = headerPrefix.trim().toLowerCase();
    if (!normalizedPrefix) {
      return totalHeaders;
    }
    return Object.keys(response.headers).filter(key =>
      key.toLowerCase().startsWith(normalizedPrefix)
    ).length;
  }, [headerPrefix, response.headers, totalHeaders]);

  const showCopyFeedback = (label: string) => {
    setCopyFeedback(label);
    window.setTimeout(() => setCopyFeedback(''), 1500);
  };

  const copyBody = () => {
    navigator.clipboard.writeText(response.body || '');
    showCopyFeedback('Body copied');
  };

  const copyHeaders = () => {
    const headerText = Object.entries(response.headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    navigator.clipboard.writeText(headerText);
    showCopyFeedback('Headers copied');
  };

  const copyAll = () => {
    const headerText = Object.entries(response.headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    const content = `${headerText}\n\n${response.body || ''}`.trim();
    navigator.clipboard.writeText(content);
    showCopyFeedback('Response copied');
  };

  const saveSnippet = () => {
    if (request && onSaveSnippet) {
      onSaveSnippet();
    }
  };

  const appendSnippet = () => {
    if (request && onAppendSnippet) {
      onAppendSnippet();
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || !event.shiftKey) {
        return;
      }
      const index = Number.parseInt(event.key, 10);
      if (Number.isNaN(index)) {
        return;
      }
      if (index === 1) {
        event.preventDefault();
        setBodyViewMode('structured');
      }
      if (index === 2) {
        event.preventDefault();
        setBodyViewMode('raw');
      }
      if (index === 3) {
        event.preventDefault();
        setBodyViewMode('preview');
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

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
              Headers ({totalHeaders})
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
            {isLargeResponse ? (
              <span className="ui-chip text-[var(--vscode-errorForeground)] border-[var(--vscode-inputValidation-warningBorder)]">
                Large response
              </span>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs ui-hover"
              onClick={() => setSummaryOnly((prev) => !prev)}
            >
              {summaryOnly ? 'Show details' : 'Summary only'}
            </Button>
            <div className="flex items-center gap-1 pl-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 ui-hover"
                onClick={copyBody}
                title="Copy body"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 ui-hover"
                onClick={copyHeaders}
                title="Copy headers"
              >
                <ClipboardList className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 ui-hover"
                onClick={copyAll}
                title="Copy headers + body (Ctrl/⌘+Shift+R)"
              >
                <Clipboard className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 ui-hover"
                onClick={saveSnippet}
                disabled={!request || !onSaveSnippet}
                title={request && onSaveSnippet ? 'Save as .http snippet' : 'No request available'}
              >
                <FileDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 ui-hover"
                onClick={appendSnippet}
                disabled={!request || !onAppendSnippet}
                title={request && onAppendSnippet ? 'Append to current .http' : 'No request available'}
              >
                <FilePlus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {summaryOnly ? (
          <div className="flex-1 p-4 space-y-2 text-sm">
            <div className="ui-card p-3 flex items-center justify-between">
              <span className="text-[var(--vscode-descriptionForeground)]">Status</span>
              <StatusBadge status={response.status} statusText={response.statusText} />
            </div>
            <div className="ui-card p-3 flex items-center justify-between">
              <span className="text-[var(--vscode-descriptionForeground)]">Time</span>
              <span>{formatTime(response.time)}</span>
            </div>
            <div className="ui-card p-3 flex items-center justify-between">
              <span className="text-[var(--vscode-descriptionForeground)]">Size</span>
              <span>{formatBytes(response.size)}</span>
            </div>
            <div className="ui-card p-3 flex items-center justify-between">
              <span className="text-[var(--vscode-descriptionForeground)]">Type</span>
              <span>{response.contentType?.split(';')[0] || 'text/plain'}</span>
            </div>
          </div>
        ) : (
          <>
            <TabsContent value="body" className="flex-1 flex flex-col p-0 m-0 overflow-hidden">
              {/* Body view mode selector */}
              <div className="ui-subbar flex items-center justify-between gap-2 px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex rounded overflow-hidden border border-[var(--vscode-input-border)]">
                    {([
                      { value: 'structured', label: 'Structured' },
                      { value: 'raw', label: 'Raw' },
                      { value: 'preview', label: 'Preview' },
                    ] as const).map((mode) => (
                      <button
                        key={mode.value}
                        onClick={() => setBodyViewMode(mode.value)}
                        className={`px-3 py-1 text-xs ${
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
                <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">
                  View shortcut Alt+Shift+1/2/3
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
              <div className="ui-subbar flex items-center gap-2 px-3 py-2 text-xs">
                <span className="text-[var(--vscode-descriptionForeground)]">Header prefix</span>
                <input
                  value={headerPrefix}
                  onChange={(event) => setHeaderPrefix(event.target.value)}
                  placeholder="e.g. x-"
                  className="px-2 py-1 bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded text-xs"
                />
                <span className="text-[var(--vscode-descriptionForeground)]">
                  Matched {filteredHeaders}/{totalHeaders}
                </span>
              </div>
              <ScrollArea className="h-full">
                <ResponseHeaders headers={response.headers} filterPrefix={headerPrefix} />
              </ScrollArea>
            </TabsContent>

            {hasTests && (
              <TabsContent value="tests" className="flex-1 p-0 m-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <TestResults results={response.testResults || []} />
                </ScrollArea>
              </TabsContent>
            )}
          </>
        )}
      </Tabs>
    </div>
  );
};
