import React from 'react';
import { ScrollArea, Button } from '@/components/ui';
import { MethodBadge } from '@/components/request';
import { StatusBadge } from '@/components/response';
import { Trash2, ExternalLink } from 'lucide-react';
import { useStore, useVsCodeMessages } from '@/hooks';

export const HistoryList: React.FC = () => {
  const { history, clearHistory, setCurrentRequest, setResponse } = useStore();
  const { openInEditor } = useVsCodeMessages();

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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-vscode-border">
        <h2 className="section-header">History</h2>
        {history.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-vscode-error"
            onClick={clearHistory}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        {history.length === 0 ? (
          <div className="p-4 text-sm text-[var(--vscode-descriptionForeground)] text-center">
            No request history yet
          </div>
        ) : (
          <div className="p-2">
            {history.map((item) => (
              <div
                key={item.id}
                className="group relative p-2 rounded-md border border-transparent transition-colors hover:bg-vscode-list-hover hover:border-[var(--vscode-sideBar-border)] cursor-pointer mb-1"
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
                  {item.response && (
                    <StatusBadge
                      status={item.response.status}
                      statusText=""
                      className="text-xs"
                    />
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 absolute right-2 top-2"
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
