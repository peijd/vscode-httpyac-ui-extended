import React, { useMemo, useState } from 'react';
import { ScrollArea, Button } from '@/components/ui';
import { MethodBadge } from '@/components/request';
import { StatusBadge } from '@/components/response';
import { Trash2, ExternalLink, Search } from 'lucide-react';
import { useStore, useVsCodeMessages } from '@/hooks';
import { formatBytes, formatTime } from '@/lib/utils';

export const HistoryList: React.FC = () => {
  const { history, clearHistory, setCurrentRequest, setResponse } = useStore();
  const { openInEditor } = useVsCodeMessages();
  const [filterText, setFilterText] = useState('');
  const [range, setRange] = useState<'all' | 'today' | '7d' | '30d'>('all');

  const handleItemClick = (item: typeof history[0]) => {
    setCurrentRequest(item.request);
    if (item.response) {
      setResponse(item.response);
    }
  };

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + 
           ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const filteredHistory = useMemo(() => {
    const normalized = filterText.trim().toLowerCase();
    const now = Date.now();
    const rangeStart = (() => {
      if (range === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today.getTime();
      }
      if (range === '7d') {
        return now - 7 * 24 * 60 * 60 * 1000;
      }
      if (range === '30d') {
        return now - 30 * 24 * 60 * 60 * 1000;
      }
      return 0;
    })();
    return history.filter((item) => {
      if (rangeStart && item.timestamp < rangeStart) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      const status = item.response?.status ? String(item.response.status) : '';
      const method = item.request.method || '';
      const url = item.request.url || '';
      return (
        url.toLowerCase().includes(normalized) ||
        method.toLowerCase().includes(normalized) ||
        status.includes(normalized)
      );
    });
  }, [filterText, history, range]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-vscode-border">
        <h2 className="section-header">History</h2>
        {history.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-vscode-error ui-hover"
            onClick={clearHistory}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      <div className="px-3 pb-2 border-b border-vscode-border">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1 px-2 py-1.5 bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded">
            <Search className="h-3.5 w-3.5 text-[var(--vscode-input-placeholderForeground)]" />
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter by URL / Method / Status"
              className="flex-1 bg-transparent text-xs outline-none text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
            />
          </div>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as typeof range)}
            className="h-8 px-2 text-xs bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded text-[var(--vscode-input-foreground)]"
          >
            <option value="all">All</option>
            <option value="today">Today</option>
            <option value="7d">7d</option>
            <option value="30d">30d</option>
          </select>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {history.length === 0 ? (
          <div className="p-4 text-sm text-[var(--vscode-descriptionForeground)] text-center">
            No request history yet
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="p-4 text-sm text-[var(--vscode-descriptionForeground)] text-center">
            No history matches the filter
          </div>
        ) : (
          <div className="p-2">
            {filteredHistory.map((item) => (
              <div
                key={item.id}
                className="group relative p-2 rounded-md border border-transparent transition-colors hover:bg-vscode-list-hover hover:border-[var(--vscode-sideBar-border)] cursor-pointer mb-1 ui-hover"
                onClick={() => handleItemClick(item)}
              >
                <div className="flex items-center gap-2">
                  <MethodBadge method={item.request.method} />
                  <span className="text-xs text-[var(--vscode-descriptionForeground)] truncate flex-1">
                    {item.request.url}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-[var(--vscode-descriptionForeground)]">
                    {formatTimestamp(item.timestamp)}
                  </span>
                  <div className="flex items-center gap-2">
                    {item.response && (
                      <>
                        <StatusBadge
                          status={item.response.status}
                          statusText=""
                          className="text-xs"
                        />
                        <span className="ui-chip text-[10px]">
                          {formatTime(item.response.time)}
                        </span>
                        <span className="ui-chip text-[10px]">
                          {formatBytes(item.response.size)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 absolute right-2 top-2 ui-hover"
                  onClick={(e) => {
                    e.stopPropagation();
                    openInEditor(item.request);
                  }}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
