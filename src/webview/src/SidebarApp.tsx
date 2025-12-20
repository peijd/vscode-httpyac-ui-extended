import React, { useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger, Button } from '@/components/ui';
import { EnvironmentSelector, HistoryList, CollectionTree } from '@/components/sidebar';
import { useStore, useVsCodeMessages } from '@/hooks';
import { History, FolderTree, Plus, Filter } from 'lucide-react';

export const SidebarApp: React.FC = () => {
  const { setCurrentRequest } = useStore();
  const { notifyReady, requestEnvironments, requestCollections, requestHistory, openInEditor } = useVsCodeMessages();

  // Initialize on mount
  useEffect(() => {
    notifyReady();
    requestEnvironments();
    requestCollections();
    requestHistory();
  }, [notifyReady, requestEnvironments, requestCollections, requestHistory]);

  const handleNewRequest = () => {
    const newRequest = {
      id: crypto.randomUUID(),
      name: 'New Request',
      method: 'GET' as const,
      url: '',
      params: [],
      headers: [],
      auth: { type: 'none' as const },
      body: { type: 'none' as const, content: '' },
    };
    setCurrentRequest(newRequest);
    openInEditor(newRequest);
  };

  return (
    <div className="flex flex-col h-screen bg-[var(--vscode-sideBar-background)]">
      {/* New Request Button */}
      <div className="p-2 border-b border-[var(--vscode-sideBar-border)]">
        <Button 
          onClick={handleNewRequest}
          className="w-full justify-start gap-2 bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] text-[var(--vscode-button-foreground)]"
        >
          <Plus className="h-4 w-4" />
          New HTTP Request
        </Button>
      </div>

      {/* Environment selector */}
      <EnvironmentSelector />

      {/* Filter input */}
      <div className="px-2 pb-2">
        <div className="flex items-center gap-2 px-2 py-1.5 bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded">
          <Filter className="h-3.5 w-3.5 text-[var(--vscode-input-placeholderForeground)]" />
          <input 
            type="text" 
            placeholder="Filter..." 
            className="flex-1 bg-transparent text-sm outline-none text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
          />
        </div>
      </div>

      {/* Collections and History tabs */}
      <Tabs defaultValue="collections" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="px-2 shrink-0 justify-start bg-transparent border-b border-[var(--vscode-sideBar-border)]">
          <TabsTrigger value="collections" className="gap-1.5 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[var(--vscode-focusBorder)] rounded-none">
            <FolderTree className="h-3.5 w-3.5" />
            Collections
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[var(--vscode-focusBorder)] rounded-none">
            <History className="h-3.5 w-3.5" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="collections" className="flex-1 overflow-hidden m-0">
          <CollectionTree />
        </TabsContent>

        <TabsContent value="history" className="flex-1 overflow-hidden m-0">
          <HistoryList />
        </TabsContent>
      </Tabs>
    </div>
  );
};

