import React, { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger, Button } from '@/components/ui';
import { EnvironmentSelector, HistoryList, CollectionTree } from '@/components/sidebar';
import { useStore, useVsCodeMessages } from '@/hooks';
import { History, FolderTree, Plus, Filter } from 'lucide-react';
import type { CollectionItem } from '@/types';

export const SidebarApp: React.FC = () => {
  const { setCurrentRequest, collections } = useStore();
  const { notifyReady, requestEnvironments, requestCollections, requestHistory, openInEditor, createCollection } =
    useVsCodeMessages();
  const [collectionFilter, setCollectionFilter] = useState('');
  const normalizedFilter = collectionFilter.trim().toLowerCase();

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

  const handleCreateCollection = () => {
    createCollection();
  };

  const matchedCount = useMemo(() => {
    if (!normalizedFilter) {
      return 0;
    }
    const matchesRequest = (item: CollectionItem) => {
      if (item.type !== 'request') {
        return false;
      }
      const candidates = [item.name, item.request?.name, item.request?.method, item.request?.url];
      return candidates.some((candidate) => (candidate || '').toLowerCase().includes(normalizedFilter));
    };
    const countRequests = (items: CollectionItem[]): number => {
      let total = 0;
      for (const item of items) {
        if (item.type === 'folder') {
          total += countRequests(item.children || []);
        } else if (matchesRequest(item)) {
          total += 1;
        }
      }
      return total;
    };
    return countRequests(collections);
  }, [collections, normalizedFilter]);

  return (
    <div className="flex flex-col h-screen bg-[var(--vscode-sideBar-background)]">
      {/* New Request Button */}
      <div className="p-2 border-b border-[var(--vscode-sideBar-border)]">
        <Button 
          onClick={handleNewRequest}
          className="w-full justify-start gap-2 bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] text-[var(--vscode-button-foreground)] shadow-sm"
        >
          <Plus className="h-4 w-4" />
          New HTTP Request
        </Button>
      </div>

      {/* Environment selector */}
      <EnvironmentSelector />

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
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-2 py-2 border-b border-[var(--vscode-sideBar-border)]">
              <Button
                onClick={handleCreateCollection}
                className="h-7 px-2 text-xs gap-1 bg-[var(--vscode-button-secondaryBackground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] text-[var(--vscode-button-secondaryForeground)] shadow-sm"
              >
                <Plus className="h-3 w-3" />
                New Collection
              </Button>
              <div className="flex items-center gap-2 px-2 py-1.5 bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded-md flex-1 shadow-sm">
                <Filter className="h-3.5 w-3.5 text-[var(--vscode-input-placeholderForeground)]" />
                <input
                  type="text"
                  placeholder="Filter collections..."
                  value={collectionFilter}
                  onChange={(event) => setCollectionFilter(event.target.value)}
                  className="flex-1 bg-transparent text-xs outline-none text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
                />
              </div>
              {normalizedFilter ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-[var(--vscode-input-border)] text-[var(--vscode-descriptionForeground)] whitespace-nowrap">
                  匹配 {matchedCount}
                </span>
              ) : null}
            </div>
            <CollectionTree filterText={collectionFilter} />
          </div>
        </TabsContent>

        <TabsContent value="history" className="flex-1 overflow-hidden m-0">
          <HistoryList />
        </TabsContent>
      </Tabs>
    </div>
  );
};
