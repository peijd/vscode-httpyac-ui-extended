import React, { useMemo } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, ScrollArea, Button } from '@/components/ui';
import { MethodBadge } from '@/components/request';
import { Folder, FileText, ExternalLink } from 'lucide-react';
import { useStore, useVsCodeMessages } from '@/hooks';
import type { CollectionItem } from '@/types';
import { cn } from '@/lib/utils';

interface CollectionNodeProps {
  item: CollectionItem;
  level: number;
  onRequestClick: (item: CollectionItem) => void;
  onOpenInEditor: (item: CollectionItem) => void;
  filterText: string;
  activeRequestId?: string;
}

function getRequestCount(item: CollectionItem): number {
  if (item.type === 'request') {
    return 1;
  }
  const children = item.children || [];
  return children.reduce((total, child) => total + getRequestCount(child), 0);
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) {
    return text;
  }
  const lower = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let startIndex = 0;
  let matchIndex = lower.indexOf(lowerQuery, startIndex);
  while (matchIndex !== -1) {
    if (matchIndex > startIndex) {
      parts.push(text.slice(startIndex, matchIndex));
    }
    parts.push(
      <span
        key={`${matchIndex}-${lowerQuery}`}
        className="rounded-sm bg-[var(--vscode-editor-findMatchHighlightBackground)] px-0.5 text-[var(--vscode-editor-findMatchHighlightForeground)]"
      >
        {text.slice(matchIndex, matchIndex + lowerQuery.length)}
      </span>
    );
    startIndex = matchIndex + lowerQuery.length;
    matchIndex = lower.indexOf(lowerQuery, startIndex);
  }
  if (startIndex < text.length) {
    parts.push(text.slice(startIndex));
  }
  return parts;
}

const CollectionNode: React.FC<CollectionNodeProps> = ({
  item,
  level,
  onRequestClick,
  onOpenInEditor,
  filterText,
  activeRequestId,
}) => {
  if (item.type === 'folder') {
    const requestCount = getRequestCount(item);
    return (
      <AccordionItem value={item.id} className="border-none">
        <AccordionTrigger
          className={cn(
            'py-1 px-2 rounded-md transition-colors hover:bg-vscode-list-hover',
            'data-[state=open]:bg-[var(--vscode-list-inactiveSelectionBackground)]'
          )}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
        >
          <div className="flex items-center gap-2 flex-1">
            <Folder className="h-4 w-4 text-[var(--vscode-symbolIcon-folderForeground)]" />
            <span className="text-sm truncate">{highlightText(item.name, filterText)}</span>
          </div>
          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full border border-[var(--vscode-input-border)] text-[var(--vscode-descriptionForeground)]">
            {requestCount}
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-0">
          {item.children?.map((child) => (
            <CollectionNode
              key={child.id}
              item={child}
              level={level + 1}
              onRequestClick={onRequestClick}
              onOpenInEditor={onOpenInEditor}
              filterText={filterText}
              activeRequestId={activeRequestId}
            />
          ))}
        </AccordionContent>
      </AccordionItem>
    );
  }

  const isActive = !!activeRequestId && item.request?.id === activeRequestId;
  const displayName = item.request ? (item.name || `${item.request.method} ${item.request.url}`) : item.name;

  return (
    <div
      className={cn(
        'group flex items-center gap-2 py-1 px-2 rounded-md cursor-pointer',
        'border border-transparent transition-colors hover:bg-vscode-list-hover hover:border-[var(--vscode-sideBar-border)]',
        isActive &&
          'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)] border-[var(--vscode-list-activeSelectionBackground)]'
      )}
      style={{ paddingLeft: `${level * 12 + 8}px` }}
      onClick={() => onRequestClick(item)}
      aria-selected={isActive}
    >
      <FileText className="h-4 w-4 text-[var(--vscode-symbolIcon-fileForeground)]" />
      {item.request ? (
        <MethodBadge method={item.request.method} className="scale-75 origin-left" />
      ) : (
        <span className="text-xs text-[var(--vscode-descriptionForeground)]">.http</span>
      )}
      <span className="text-sm truncate flex-1">
        {highlightText(displayName, filterText)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onOpenInEditor(item);
        }}
      >
        <ExternalLink className="h-3 w-3" />
      </Button>
    </div>
  );
};

interface CollectionTreeProps {
  filterText?: string;
}

function normalizeText(value: string | undefined): string {
  return (value || '').toLowerCase();
}

function matchesRequest(item: CollectionItem, query: string): boolean {
  if (!query) {
    return true;
  }
  if (item.type !== 'request') {
    return false;
  }
  const request = item.request;
  const candidates = [item.name, request?.name, request?.method, request?.url];
  return candidates.some((candidate) => normalizeText(candidate).includes(query));
}

function filterCollections(items: CollectionItem[], query: string): CollectionItem[] {
  if (!query) {
    return items;
  }
  const results: CollectionItem[] = [];
  for (const item of items) {
    if (item.type === 'folder') {
      const children = item.children || [];
      const filteredChildren = filterCollections(children, query);
      if (filteredChildren.length > 0) {
        results.push({ ...item, children: filteredChildren });
      }
      continue;
    }
    if (matchesRequest(item, query)) {
      results.push(item);
    }
  }
  return results;
}

function collectFolderIds(items: CollectionItem[], ids: string[] = []): string[] {
  for (const item of items) {
    if (item.type === 'folder') {
      ids.push(item.id);
      if (item.children?.length) {
        collectFolderIds(item.children, ids);
      }
    }
  }
  return ids;
}

export const CollectionTree: React.FC<CollectionTreeProps> = ({ filterText = '' }) => {
  const { collections, setCurrentRequest, currentRequest } = useStore();
  const { openInEditor, openHttpFile } = useVsCodeMessages();
  const normalizedFilter = filterText.trim().toLowerCase();
  const filteredCollections = useMemo(
    () => filterCollections(collections, normalizedFilter),
    [collections, normalizedFilter]
  );
  const expandedFolderIds = useMemo(
    () => collectFolderIds(filteredCollections),
    [filteredCollections]
  );

  const handleRequestClick = (item: CollectionItem) => {
    if (item.request) {
      // Set the request and open in editor panel
      setCurrentRequest(item.request);
      openInEditor(item.request);
    } else if (item.httpFilePath) {
      // Open the http file if no parsed request
      openHttpFile(item.httpFilePath);
    }
  };

  const handleOpenInEditor = (item: CollectionItem) => {
    if (item.request) {
      openInEditor(item.request);
    } else if (item.httpFilePath) {
      openHttpFile(item.httpFilePath);
    }
  };

  return (
    <ScrollArea className="flex-1">
      {collections.length === 0 ? (
        <div className="p-4 text-sm text-[var(--vscode-descriptionForeground)] text-center">
          No .http files found.
          <br />
          <span className="text-xs opacity-70">
            Create .http or .rest files in your workspace.
          </span>
        </div>
      ) : filteredCollections.length === 0 ? (
        <div className="p-4 text-sm text-[var(--vscode-descriptionForeground)] text-center">
          No collections match the filter.
        </div>
      ) : normalizedFilter ? (
        <Accordion type="multiple" className="py-1" value={expandedFolderIds}>
          {filteredCollections.map((item) => (
            <CollectionNode
              key={item.id}
              item={item}
              level={0}
              onRequestClick={handleRequestClick}
              onOpenInEditor={handleOpenInEditor}
              filterText={normalizedFilter}
              activeRequestId={currentRequest.id}
            />
          ))}
        </Accordion>
      ) : (
        <Accordion type="multiple" className="py-1">
          {filteredCollections.map((item) => (
            <CollectionNode
              key={item.id}
              item={item}
              level={0}
              onRequestClick={handleRequestClick}
              onOpenInEditor={handleOpenInEditor}
              filterText={normalizedFilter}
              activeRequestId={currentRequest.id}
            />
          ))}
        </Accordion>
      )}
    </ScrollArea>
  );
};
