import React from 'react';
import { cn, getStatusColor } from '@/lib/utils';

interface StatusBadgeProps {
  status: number;
  statusText: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, statusText, className }) => {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className={cn('ui-chip font-semibold', getStatusColor(status))}>
        {status}
      </span>
      {statusText ? <span className="text-[var(--vscode-descriptionForeground)]">{statusText}</span> : null}
    </div>
  );
};
