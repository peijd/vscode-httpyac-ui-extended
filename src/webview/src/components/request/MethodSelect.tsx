import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import type { HttpMethod } from '@/types';
import { cn, getMethodColor } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

interface MethodSelectProps {
  value: HttpMethod;
  onChange: (value: HttpMethod) => void;
  className?: string;
}

export const MethodSelect: React.FC<MethodSelectProps> = ({ value, onChange, className }) => {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as HttpMethod)}>
      <SelectTrigger className={cn(
        'w-[120px] font-bold border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)]',
        className
      )}>
        <SelectValue>
          <span className={cn('font-bold', getMethodColor(value))}>{value}</span>
        </SelectValue>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </SelectTrigger>
      <SelectContent className="bg-[var(--vscode-dropdown-background)] border-[var(--vscode-dropdown-border)]">
        {METHODS.map((method) => (
          <SelectItem 
            key={method} 
            value={method}
            className="hover:bg-[var(--vscode-list-hoverBackground)]"
          >
            <span className={cn('font-bold', getMethodColor(method))}>{method}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

