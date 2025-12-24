import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, ScrollArea, Button } from '@/components/ui';
import { useStore, useVsCodeMessages } from '@/hooks';
import type { BatchRunEntry, BatchRunSummary, KeyValue, BatchRunOptions, FailureBehavior } from '@/types';
import { cn } from '@/lib/utils';
import { Download, Settings, Play, X } from 'lucide-react';

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

function exportAsJson(summary: BatchRunSummary): void {
  const content = JSON.stringify(summary, null, 2);
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `runner-report-${summary.label.replace(/[^a-zA-Z0-9]/g, '_')}-${summary.startedAt}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAsMarkdown(summary: BatchRunSummary): void {
  const lines: string[] = [];
  lines.push(`# Runner Report: ${summary.label}`);
  lines.push('');
  lines.push(`**Started:** ${formatDate(summary.startedAt)}`);
  lines.push(`**Finished:** ${formatDate(summary.finishedAt)}`);
  lines.push(`**Duration:** ${formatDuration(summary.durationMs)}`);
  if (summary.totalIterations && summary.totalIterations > 1) {
    lines.push(`**Iteration:** ${summary.iteration} of ${summary.totalIterations}`);
  }
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Requests | ${summary.totalRequests} |`);
  lines.push(`| Failed Requests | ${summary.failedRequests} |`);
  lines.push(`| Total Tests | ${summary.totalTests} |`);
  lines.push(`| Failed Tests | ${summary.failedTests} |`);
  lines.push('');
  lines.push('## Files');
  lines.push('');
  for (const file of summary.files) {
    lines.push(`### ${formatPath(file.filePath)}`);
    lines.push('');
    lines.push(`Duration: ${formatDuration(file.durationMs)}`);
    if (file.error) {
      lines.push(``);
      lines.push(`**Error:** ${file.error}`);
    }
    lines.push('');
    lines.push(`| Request | Method | Status | Duration | Tests |`);
    lines.push(`|---------|--------|--------|----------|-------|`);
    for (const entry of file.entries) {
      const testInfo = entry.testTotal ? `${entry.testFailed}/${entry.testTotal}` : '-';
      lines.push(`| ${entry.name} | ${entry.method || '-'} | ${entry.status || '-'} | ${formatDuration(entry.durationMs)} | ${testInfo} |`);
    }
    lines.push('');
  }
  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `runner-report-${summary.label.replace(/[^a-zA-Z0-9]/g, '_')}-${summary.startedAt}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

const DEFAULT_OPTIONS: BatchRunOptions = {
  iterations: 1,
  delayMs: 0,
  failureBehavior: 'continue',
};

export const RunnerApp: React.FC = () => {
  const { runnerResults } = useStore();
  const { notifyReady, requestRunnerResults, runCollection } = useVsCodeMessages();
  const [filter, setFilter] = useState<'all' | 'failed' | 'passed' | 'testFailed'>('all');
  const [showOptions, setShowOptions] = useState(false);
  const [runOptions, setRunOptions] = useState<BatchRunOptions>(DEFAULT_OPTIONS);

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

  const handleRunAgain = useCallback((summary: BatchRunSummary) => {
    const filePaths = Array.from(new Set(summary.files.map(file => file.filePath)));
    if (filePaths.length === 0) {
      return;
    }
    // Re-use original options if available, otherwise use current options
    const options = summary.options || runOptions;
    runCollection({ label: summary.label.replace(/\s*\(\d+\/\d+\)$/u, ''), filePaths, options });
  }, [runCollection, runOptions]);

  const updateOption = useCallback(<K extends keyof BatchRunOptions>(key: K, value: BatchRunOptions[K]) => {
    setRunOptions(prev => ({ ...prev, [key]: value }));
  }, []);

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
      <div className="ui-subbar px-3 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
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
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 gap-1"
          onClick={() => setShowOptions(!showOptions)}
        >
          <Settings className="h-3.5 w-3.5" />
          Run Options
        </Button>
      </div>

      {showOptions && (
        <div className="px-3 py-3 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-editorWidget-background)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">Run Configuration</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setShowOptions(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-[var(--vscode-descriptionForeground)]">Iterations</label>
              <input
                type="number"
                min={1}
                max={100}
                value={runOptions.iterations || 1}
                onChange={e => updateOption('iterations', Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-2 py-1 text-xs bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded"
              />
              <div className="text-[10px] text-[var(--vscode-descriptionForeground)]">
                Run collection multiple times
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[var(--vscode-descriptionForeground)]">Delay (ms)</label>
              <input
                type="number"
                min={0}
                max={60000}
                step={100}
                value={runOptions.delayMs || 0}
                onChange={e => updateOption('delayMs', Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-2 py-1 text-xs bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded"
              />
              <div className="text-[10px] text-[var(--vscode-descriptionForeground)]">
                Delay between requests
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[var(--vscode-descriptionForeground)]">On Failure</label>
              <select
                value={runOptions.failureBehavior || 'continue'}
                onChange={e => updateOption('failureBehavior', e.target.value as FailureBehavior)}
                className="w-full px-2 py-1 text-xs bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded"
              >
                <option value="continue">Continue</option>
                <option value="stopFile">Stop current file</option>
                <option value="stopAll">Stop all</option>
              </select>
              <div className="text-[10px] text-[var(--vscode-descriptionForeground)]">
                Behavior when request fails
              </div>
            </div>
          </div>
        </div>
      )}

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
                        {summary.totalIterations && summary.totalIterations > 1 && (
                          <span className="ml-2">· Iteration {summary.iteration}/{summary.totalIterations}</span>
                        )}
                        {summary.options?.delayMs ? (
                          <span className="ml-2">· Delay {summary.options.delayMs}ms</span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 gap-1"
                          onClick={() => exportAsJson(summary)}
                          title="Export as JSON"
                        >
                          <Download className="h-3.5 w-3.5" />
                          JSON
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 gap-1"
                          onClick={() => exportAsMarkdown(summary)}
                          title="Export as Markdown"
                        >
                          <Download className="h-3.5 w-3.5" />
                          MD
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="gap-1"
                          onClick={() => handleRunAgain(summary)}
                        >
                          <Play className="h-3.5 w-3.5" />
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
