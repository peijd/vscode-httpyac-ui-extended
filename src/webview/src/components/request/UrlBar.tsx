import React from 'react';
import { Button, Input } from '@/components/ui';
import { MethodSelect } from './MethodSelect';
import { Play, Loader2, Save } from 'lucide-react';
import type { HttpMethod } from '@/types';
import { cn } from '@/lib/utils';
import type { VariablePreviewResult } from '@/lib/variablePreview';

interface UrlBarProps {
  method: HttpMethod;
  url: string;
  isLoading: boolean;
  onMethodChange: (method: HttpMethod) => void;
  onUrlChange: (url: string) => void;
  onSend: () => void;
  onSave?: () => void;
  showSave?: boolean;
  className?: string;
  preview?: VariablePreviewResult | null;
}

export const UrlBar: React.FC<UrlBarProps> = ({
  method,
  url,
  isLoading,
  onMethodChange,
  onUrlChange,
  onSend,
  onSave,
  showSave = false,
  className,
  preview,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      onSend();
    }
  };

  return (
    <div className={cn('flex items-start gap-2', className)}>
      <MethodSelect value={method} onChange={onMethodChange} />
      <div className="flex-1 flex flex-col gap-1">
        <Input
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter request URL..."
          className="flex-1 font-mono"
        />
        {preview?.hasTemplate ? (
          <div className="text-[10px] text-[var(--vscode-descriptionForeground)]">
            <div className="truncate">Preview: {preview.resolved}</div>
            {preview.missing.length > 0 ? (
              <div className="text-[var(--vscode-errorForeground)]">
                Missing: {preview.missing.join(', ')}
              </div>
            ) : null}
            {preview.dynamic.length > 0 ? (
              <div>Dynamic: {preview.dynamic.join(', ')}</div>
            ) : null}
          </div>
        ) : null}
      </div>
      <Button onClick={onSend} disabled={isLoading || !url} className="gap-2">
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            Send
          </>
        )}
      </Button>
      {showSave && onSave && (
        <Button variant="secondary" onClick={onSave} className="gap-2">
          <Save className="h-4 w-4" />
          Save
        </Button>
      )}
    </div>
  );
};
