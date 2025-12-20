import React from 'react';
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
}

const CollectionNode: React.FC<CollectionNodeProps> = ({
  item,
  level,
  onRequestClick,
  onOpenInEditor,
}) => {
  if (item.type === 'folder') {
    return (
      <AccordionItem value={item.id} className="border-none">
        <AccordionTrigger
          className={cn('py-1 px-2 hover:bg-vscode-list-hover rounded')}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
        >
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-[var(--vscode-symbolIcon-folderForeground)]" />
            <span className="text-sm truncate">{item.name}</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pb-0">
          {item.children?.map((child) => (
            <CollectionNode
              key={child.id}
              item={child}
              level={level + 1}
              onRequestClick={onRequestClick}
              onOpenInEditor={onOpenInEditor}
            />
          ))}
        </AccordionContent>
      </AccordionItem>
    );
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-vscode-list-hover'
      )}
      style={{ paddingLeft: `${level * 12 + 8}px` }}
      onClick={() => onRequestClick(item)}
    >
      <FileText className="h-4 w-4 text-[var(--vscode-symbolIcon-fileForeground)]" />
      {item.request ? (
        <MethodBadge method={item.request.method} className="scale-75 origin-left" />
      ) : (
        <span className="text-xs text-[var(--vscode-descriptionForeground)]">.http</span>
      )}
      <span className="text-sm truncate flex-1">
        {item.request ? (item.name || `${item.request.method} ${item.request.url}`) : item.name}
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

export const CollectionTree: React.FC = () => {
  const { collections, setCurrentRequest } = useStore();
  const { openInEditor, openHttpFile } = useVsCodeMessages();

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
      ) : (
        <Accordion type="multiple" className="py-1">
          {collections.map((item) => (
            <CollectionNode
              key={item.id}
              item={item}
              level={0}
              onRequestClick={handleRequestClick}
              onOpenInEditor={handleOpenInEditor}
            />
          ))}
        </Accordion>
      )}
    </ScrollArea>
  );
};

