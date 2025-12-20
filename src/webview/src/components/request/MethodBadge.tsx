import React from 'react';
import { cn, getMethodColor } from '@/lib/utils';

interface MethodBadgeProps {
  method: string;
  className?: string;
}

export const MethodBadge: React.FC<MethodBadgeProps> = ({ method, className }) => {
  return (
    <span className={cn('method-badge', getMethodColor(method), className)}>
      {method}
    </span>
  );
};

