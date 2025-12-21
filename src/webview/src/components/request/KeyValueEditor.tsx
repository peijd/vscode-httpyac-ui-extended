import React from 'react';
import { Button } from '@/components/ui';
import { Trash2 } from 'lucide-react';
import type { KeyValue } from '@/types';
import { cn } from '@/lib/utils';

interface KeyValueEditorProps {
  items: KeyValue[];
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<KeyValue>) => void;
  onRemove: (id: string) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  className?: string;
}

export const KeyValueEditor: React.FC<KeyValueEditorProps> = ({
  items,
  onAdd,
  onUpdate,
  onRemove,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  className,
}) => {
  return (
    <div className={cn('ui-card overflow-hidden', className)}>
      <table className="w-full border-collapse">
        <thead className="bg-[var(--vscode-editor-background)]">
          <tr className="border-b border-[var(--vscode-panel-border)]">
            <th className="w-8 p-2"></th>
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
          {items.map((item) => (
            <tr 
              key={item.id} 
              className={cn(
                'border-b border-[var(--vscode-panel-border)] hover:bg-[var(--vscode-list-hoverBackground)] transition-colors',
                !item.enabled && 'opacity-50'
              )}
            >
              <td className="p-2 text-center">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(e) => onUpdate(item.id, { enabled: e.target.checked })}
                  className="h-4 w-4 cursor-pointer accent-[var(--vscode-focusBorder)]"
                />
              </td>
              <td className="p-1">
                <input
                  value={item.key}
                  onChange={(e) => onUpdate(item.id, { key: e.target.value })}
                  placeholder={keyPlaceholder}
                  className="w-full px-2 py-1.5 bg-transparent border border-transparent rounded text-sm focus:bg-[var(--vscode-input-background)] focus:border-[var(--vscode-focusBorder)] outline-none"
                />
              </td>
              <td className="p-1">
                <input
                  value={item.value}
                  onChange={(e) => onUpdate(item.id, { value: e.target.value })}
                  placeholder={valuePlaceholder}
                  className="w-full px-2 py-1.5 bg-transparent border border-transparent rounded text-sm focus:bg-[var(--vscode-input-background)] focus:border-[var(--vscode-focusBorder)] outline-none"
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
              />
            </td>
            <td className="p-1">
              <input
                placeholder={valuePlaceholder}
                className="w-full px-2 py-1.5 bg-transparent border border-transparent rounded text-sm focus:bg-[var(--vscode-input-background)] focus:border-[var(--vscode-focusBorder)] outline-none placeholder:text-[var(--vscode-input-placeholderForeground)]"
                onFocus={onAdd}
              />
            </td>
            <td className="p-2"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
