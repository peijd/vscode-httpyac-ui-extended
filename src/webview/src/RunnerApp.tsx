import React, { useEffect, useMemo, useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, ScrollArea, Button } from '@/components/ui';
import { useStore, useVsCodeMessages } from '@/hooks';
import type { BatchRunEntry, BatchRunSummary, KeyValue } from '@/types';
import { cn } from '@/lib/utils';

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function formatDuration(value?: number): string {
  if (!value) {
    return '-';
  }
  return `${value} ms`;
}

function statusClass(status?: number): string {
  if (!status) {
    return '';
  }
  if (status >= 500) {
    return 'status-5xx';
  }
  if (status >= 400) {
    return 'status-4xx';
  }
  if (status >= 300) {
    return 'status-3xx';
  }
  return 'status-2xx';
}

function formatPath(path: string): string {
  const normalized = path.replace(/\\/gu, '/');
  const parts = normalized.split('/');
  if (parts.length <= 2) {
    return normalized;
  }
  return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
}

function renderTestSummary(entry: BatchRunEntry): string {
  if (!entry.testTotal) {
    return '-';
  }
  return `${entry.testFailed}/${entry.testTotal}`;
}

function renderKeyValues(items?: KeyValue[]): React.ReactNode {
  if (!items || items.length === 0) {
    return <div className="text-xs text-[var(--vscode-descriptionForeground)]">无</div>;
  }
  return (
    <div className="space-y-1 text-xs">
      {items.map(item => (
        <div key={item.id} className="flex items-start gap-2">
          <span className="font-medium">{item.key}</span>
          <span className="text-[var(--vscode-descriptionForeground)]">=</span>
          <span className="break-all">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function formatBody(content?: string): string {
  if (!content) {
    return '';
  }
  try {
    const parsed = JSON.parse(content);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return content;
  }
}

function summaryKey(summary: BatchRunSummary, index: number): string {
  return `${summary.startedAt}-${summary.label}-${index}`;
}

export const RunnerApp: React.FC = () => {
  const { runnerResults } = useStore();
  const { notifyReady, requestRunnerResults, runCollection } = useVsCodeMessages();
  const [filter, setFilter] = useState<'all' | 'failed' | 'passed' | 'testFailed'>('all');

  useEffect(() => {
    notifyReady();
    requestRunnerResults();
  }, [notifyReady, requestRunnerResults]);

  const emptyState = runnerResults.length === 0;
  const summaryCount = useMemo(() => runnerResults.length, [runnerResults.length]);
  const filterStats = useMemo(() => {
    let total = 0;
    let failed = 0;
    let testFailed = 0;
    runnerResults.forEach(summary => {
      total += summary.totalRequests;
      failed += summary.failedRequests;
      summary.files.forEach(file => {
        file.entries.forEach(entry => {
          testFailed += entry.testFailed;
        });
      });
    });
    const passed = Math.max(total - failed, 0);
    return { total, failed, passed, testFailed };
  }, [runnerResults]);

  const entryMatchesFilter = (entry: BatchRunEntry): boolean => {
    if (filter === 'all') {
      return true;
    }
    const hasFailed = (entry.status && entry.status >= 400) || entry.testFailed > 0;
    if (filter === 'failed') {
      return hasFailed;
    }
    if (filter === 'passed') {
      return !hasFailed;
    }
    return entry.testFailed > 0;
  };

  const handleRunAgain = (summary: BatchRunSummary) => {
    const filePaths = Array.from(new Set(summary.files.map(file => file.filePath)));
    if (filePaths.length === 0) {
      return;
    }
    runCollection({ label: summary.label, filePaths });
  };

  return (
    <div className="flex flex-col h-screen bg-vscode-background text-vscode-foreground">
      <div className="ui-topbar px-3 py-2 flex items-center justify-between">
        <div className="text-sm font-semibold">Runner Results</div>
        <div className="flex items-center gap-2">
          <span className="ui-chip">Runs {summaryCount}</span>
          <span className="ui-chip">All {filterStats.total}</span>
          <span className="ui-chip text-[var(--vscode-errorForeground)]">Fail {filterStats.failed}</span>
          <span className="ui-chip">Passed {filterStats.passed}</span>
          <span className="ui-chip">Test Fail {filterStats.testFailed}</span>
        </div>
      </div>
      <div className="ui-subbar px-3 py-2 flex items-center gap-2 text-xs">
        <span className="text-[var(--vscode-descriptionForeground)]">Filter:</span>
        {(
          [
            { key: 'all', label: 'All' },
            { key: 'failed', label: 'Failed' },
            { key: 'passed', label: 'Passed' },
            { key: 'testFailed', label: 'Test Failed' },
          ] as const
        ).map(item => (
          <button
            key={item.key}
            className={cn(
              'runner-filter',
              filter === item.key && 'runner-filter-active'
            )}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1 p-3">
        {emptyState ? (
          <div className="ui-card p-6 text-center text-sm text-[var(--vscode-descriptionForeground)]">
            No runner results yet.
            <div className="mt-2 text-xs opacity-70">Run a collection to see aggregated results.</div>
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-3">
            {runnerResults.map((summary, index) => (
              <AccordionItem
                key={summaryKey(summary, index)}
                value={summaryKey(summary, index)}
                className="ui-card border border-[var(--vscode-panel-border)]"
              >
                <AccordionTrigger className="px-3 py-2 text-sm">
                  <div className="flex flex-col items-start gap-1 flex-1">
                    <div className="font-medium">{summary.label}</div>
                    <div className="text-xs text-[var(--vscode-descriptionForeground)]">
                      {formatDate(summary.startedAt)} · {formatDuration(summary.durationMs)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="ui-chip">Req {summary.totalRequests}</span>
                    <span className="ui-chip text-[var(--vscode-errorForeground)]">Fail {summary.failedRequests}</span>
                    <span className="ui-chip">
                      Tests {summary.failedTests}/{summary.totalTests}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs text-[var(--vscode-descriptionForeground)]">
                        {summary.files.length} files · Finished {formatDate(summary.finishedAt)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRunAgain(summary)}
                        >
                          Run Again
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-3">
                    {summary.files
                      .map(file => {
                        const filteredEntries = filter === 'all'
                          ? file.entries
                          : file.entries.filter(entryMatchesFilter);
                        return { file, filteredEntries };
                      })
                      .filter(item => filter === 'all' || item.filteredEntries.length > 0)
                      .map(({ file, filteredEntries }) => (
                      <div key={`${summary.startedAt}-${file.filePath}`} className="rounded-md border border-[var(--vscode-panel-border)]">
                        <div className="flex items-center justify-between px-3 py-2 text-xs bg-[var(--vscode-editorWidget-background)]">
                          <span className="font-medium">{formatPath(file.filePath)}</span>
                          <span className="text-[var(--vscode-descriptionForeground)]">
                            {formatDuration(file.durationMs)} · {file.entries.length} requests
                          </span>
                        </div>
                        {file.error ? (
                          <div className="px-3 py-2 text-xs text-[var(--vscode-errorForeground)] bg-[var(--vscode-inputValidation-errorBackground)]">
                            {file.error}
                          </div>
                        ) : null}
                        <div className="px-3 py-2 space-y-2">
                          {filteredEntries.length === 0 ? (
                            <div className="text-xs text-center text-[var(--vscode-descriptionForeground)]">No entries</div>
                          ) : (
                            filteredEntries.map((entry, entryIndex) => {
                              const request = entry.request;
                              const response = entry.response;
                              return (
                                <details key={`${file.filePath}-${entryIndex}`} className="runner-entry">
                                  <summary className="runner-entry-summary">
                                    <div className="flex flex-1 items-center gap-3">
                                      <span className="font-medium">{entry.name}</span>
                                      <span className={cn('method-badge', entry.method ? `method-${entry.method.toLowerCase()}` : '')}>
                                        {entry.method || '-'}
                                      </span>
                                      <span className="truncate text-xs text-[var(--vscode-descriptionForeground)]" title={entry.url || ''}>
                                        {entry.url || '-'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className={statusClass(entry.status)}>
                                        {entry.status ? `${entry.status}` : '-'}
                                      </span>
                                      <span>{formatDuration(entry.durationMs)}</span>
                                      <span>{renderTestSummary(entry)}</span>
                                    </div>
                                  </summary>
                                  <div className="runner-entry-details">
                                    <div className="runner-section">
                                      <div className="runner-section-title">Request</div>
                                      <div className="runner-section-body">
                                        <div className="text-xs">
                                          <span className="font-medium">{request?.method || entry.method}</span>{' '}
                                          {request?.url || entry.url}
                                        </div>
                                        <div className="runner-kv">
                                          <div className="runner-kv-title">Params</div>
                                          {renderKeyValues(request?.params)}
                                        </div>
                                        <div className="runner-kv">
                                          <div className="runner-kv-title">Headers</div>
                                          {renderKeyValues(request?.headers)}
                                        </div>
                                        {request?.body?.content ? (
                                          <div className="runner-kv">
                                            <div className="runner-kv-title">Body</div>
                                            <pre className="runner-pre">{formatBody(request.body.content)}</pre>
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                    <div className="runner-section">
                                      <div className="runner-section-title">Response</div>
                                      <div className="runner-section-body">
                                        <div className="text-xs">
                                          状态：{response?.status || entry.status || '-'} {response?.statusText || entry.statusText || ''}
                                        </div>
                                        <div className="runner-kv">
                                          <div className="runner-kv-title">Headers</div>
                                          {response?.headers ? (
                                            <div className="space-y-1 text-xs">
                                              {Object.entries(response.headers).map(([key, value]) => (
                                                <div key={key} className="flex items-start gap-2">
                                                  <span className="font-medium">{key}</span>
                                                  <span className="text-[var(--vscode-descriptionForeground)]">=</span>
                                                  <span className="break-all">{value}</span>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <div className="text-xs text-[var(--vscode-descriptionForeground)]">无</div>
                                          )}
                                        </div>
                                        {response?.body ? (
                                          <div className="runner-kv">
                                            <div className="runner-kv-title">Body</div>
                                            <pre className="runner-pre">{formatBody(response.body)}</pre>
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                </details>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </ScrollArea>
    </div>
  );
};
