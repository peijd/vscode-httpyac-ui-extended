import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui';
import { GripVertical, Trash2 } from 'lucide-react';
import type { KeyValue } from '@/types';
import { cn, generateId } from '@/lib/utils';

interface KeyValueEditorProps {
  items: KeyValue[];
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<KeyValue>) => void;
  onRemove: (id: string) => void;
  onItemsChange?: (items: KeyValue[]) => void;
  enableRowDrag?: boolean;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  className?: string;
}

export const KeyValueEditor: React.FC<KeyValueEditorProps> = ({
  items,
  onAdd,
  onUpdate,
  onRemove,
  onItemsChange,
  enableRowDrag = true,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  className,
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const canReorder = enableRowDrag && !!onItemsChange;

  const parseLines = (text: string) => {
    const lines = text.replace(/\r\n/gu, '\n').split('\n').filter(line => line.trim().length > 0);
    return lines.map((line) => {
      const tabIndex = line.indexOf('\t');
      const colonIndex = line.indexOf(':');
      const eqIndex = line.indexOf('=');
      let splitIndex = -1;
      if (tabIndex > -1) splitIndex = tabIndex;
      else if (colonIndex > -1) splitIndex = colonIndex;
      else if (eqIndex > -1) splitIndex = eqIndex;
      if (splitIndex > -1) {
        return {
          key: line.slice(0, splitIndex).trim(),
          value: line.slice(splitIndex + 1).trim(),
        };
      }
      return { key: line.trim(), value: '' };
    });
  };

  const applyBulkInsert = (index: number, pairs: Array<{ key: string; value: string }>) => {
    if (!onItemsChange || pairs.length === 0) {
      return;
    }
    const next = [...items];
    let targetIndex = index;
    if (targetIndex >= next.length && next.length > 0) {
      const last = next[next.length - 1];
      if (last && !last.key && !last.value) {
        targetIndex = next.length - 1;
      }
    }
    if (targetIndex >= 0 && targetIndex < next.length) {
      next[targetIndex] = {
        ...next[targetIndex],
        key: pairs[0].key,
        value: pairs[0].value,
        enabled: true,
      };
      const insert = pairs.slice(1).map(pair => ({
        id: generateId(),
        key: pair.key,
        value: pair.value,
        enabled: true,
      }));
      next.splice(targetIndex + 1, 0, ...insert);
    } else {
      const insert = pairs.map(pair => ({
        id: generateId(),
        key: pair.key,
        value: pair.value,
        enabled: true,
      }));
      next.push(...insert);
    }
    onItemsChange(next);
  };

  const moveItem = (fromId: string, toId: string) => {
    if (!onItemsChange) {
      return;
    }
    const fromIndex = items.findIndex(item => item.id === fromId);
    const toIndex = items.findIndex(item => item.id === toId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return;
    }
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onItemsChange(next);
  };

  const dragHint = useMemo(() => (canReorder ? 'Drag to reorder' : ''), [canReorder]);

  return (
    <div className={cn('ui-card overflow-hidden', className)}>
      <table className="w-full border-collapse">
        <thead className="bg-[var(--vscode-editor-background)]">
          <tr className="border-b border-[var(--vscode-panel-border)]">
            <th className="w-12 p-2"></th>
            <th className="text-left p-2 text-xs font-medium text-[var(--vscode-descriptionForeground)]">
              {keyPlaceholder.toUpperCase()}
            </th>
            <th className="text-left p-2 text-xs font-medium text-[var(--vscode-descriptionForeground)]">
              {valuePlaceholder.toUpperCase()}
            </th>
            <th className="w-8 p-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr 
              key={item.id} 
              className={cn(
                'border-b border-[var(--vscode-panel-border)] hover:bg-[var(--vscode-list-hoverBackground)] transition-colors',
                !item.enabled && 'opacity-60 bg-[var(--vscode-editor-background)]',
                dragOverId === item.id && 'bg-[var(--vscode-list-hoverBackground)]'
              )}
              draggable={canReorder}
              onDragStart={(event) => {
                if (!canReorder) return;
                const target = event.target as HTMLElement | null;
                if (target && !target.closest('[data-drag-handle="true"]')) {
                  event.preventDefault();
                  return;
                }
                setDraggingId(item.id);
              }}
              onDragOver={(event) => {
                if (!canReorder || !draggingId) return;
                event.preventDefault();
                setDragOverId(item.id);
              }}
              onDragLeave={() => {
                if (!canReorder) return;
                setDragOverId(null);
              }}
              onDrop={(event) => {
                if (!canReorder || !draggingId) return;
                event.preventDefault();
                moveItem(draggingId, item.id);
                setDraggingId(null);
                setDragOverId(null);
              }}
              onDragEnd={() => {
                setDraggingId(null);
                setDragOverId(null);
              }}
            >
              <td className="p-2 text-center">
                <div className="flex items-center justify-center gap-1">
                  {canReorder ? (
                    <span
                      className="cursor-grab text-[var(--vscode-descriptionForeground)]"
                      title={dragHint}
                      data-drag-handle="true"
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(e) => onUpdate(item.id, { enabled: e.target.checked })}
                    className="h-4 w-4 cursor-pointer accent-[var(--vscode-focusBorder)]"
                  />
                </div>
              </td>
              <td className="p-1">
                <input
                  value={item.key}
                  onChange={(e) => onUpdate(item.id, { key: e.target.value })}
                  placeholder={keyPlaceholder}
                  onPaste={(event) => {
                    const text = event.clipboardData.getData('text');
                    const pairs = parseLines(text);
                    if (pairs.length > 1) {
                      event.preventDefault();
                      applyBulkInsert(index, pairs);
                    }
                  }}
                  className={cn(
                    'w-full px-2 py-1.5 bg-transparent border border-transparent rounded text-sm focus:bg-[var(--vscode-input-background)] focus:border-[var(--vscode-focusBorder)] outline-none',
                    !item.enabled && 'line-through'
                  )}
                />
              </td>
              <td className="p-1">
                <input
                  value={item.value}
                  onChange={(e) => onUpdate(item.id, { value: e.target.value })}
                  placeholder={valuePlaceholder}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      onAdd();
                    }
                    if (event.key === 'Tab' && !event.shiftKey && index === items.length - 1) {
                      onAdd();
                    }
                  }}
                  onPaste={(event) => {
                    const text = event.clipboardData.getData('text');
                    const pairs = parseLines(text);
                    if (pairs.length > 1) {
                      event.preventDefault();
                      applyBulkInsert(index, pairs);
                    }
                  }}
                  className={cn(
                    'w-full px-2 py-1.5 bg-transparent border border-transparent rounded text-sm focus:bg-[var(--vscode-input-background)] focus:border-[var(--vscode-focusBorder)] outline-none',
                    !item.enabled && 'line-through'
                  )}
                />
              </td>
              <td className="p-2 text-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-50 hover:opacity-100 hover:text-[#f93e3e]"
                  onClick={() => onRemove(item.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </td>
            </tr>
          ))}
          {/* Add new row */}
          <tr className="border-b border-[var(--vscode-panel-border)]">
            <td className="p-2 text-center">
              <input
                type="checkbox"
                checked={true}
                disabled
                className="h-4 w-4 opacity-30"
              />
            </td>
            <td className="p-1">
              <input
                placeholder={keyPlaceholder}
                className="w-full px-2 py-1.5 bg-transparent border border-transparent rounded text-sm focus:bg-[var(--vscode-input-background)] focus:border-[var(--vscode-focusBorder)] outline-none placeholder:text-[var(--vscode-input-placeholderForeground)]"
                onFocus={onAdd}
                onPaste={(event) => {
                  const text = event.clipboardData.getData('text');
                  const pairs = parseLines(text);
                  if (pairs.length > 0) {
                    event.preventDefault();
                    applyBulkInsert(items.length, pairs);
                  }
                }}
              />
            </td>
            <td className="p-1">
              <input
                placeholder={valuePlaceholder}
                className="w-full px-2 py-1.5 bg-transparent border border-transparent rounded text-sm focus:bg-[var(--vscode-input-background)] focus:border-[var(--vscode-focusBorder)] outline-none placeholder:text-[var(--vscode-input-placeholderForeground)]"
                onFocus={onAdd}
                onPaste={(event) => {
                  const text = event.clipboardData.getData('text');
                  const pairs = parseLines(text);
                  if (pairs.length > 0) {
                    event.preventDefault();
                    applyBulkInsert(items.length, pairs);
                  }
                }}
              />
            </td>
            <td className="p-2"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
