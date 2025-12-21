import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Button } from '@/components/ui';
import { RefreshCw } from 'lucide-react';
import { useStore, useVsCodeMessages } from '@/hooks';

export const EnvironmentSelector: React.FC = () => {
  const { environments, activeEnvironments } = useStore();
  const { selectEnvironments, requestEnvironments } = useVsCodeMessages();
  const activeEnv = environments.find((env) => env.name === activeEnvironments[0]);
  const activeVarCount = activeEnv ? Object.keys(activeEnv.variables || {}).length : 0;

  const handleEnvChange = (envName: string) => {
    if (envName === 'none') {
      selectEnvironments([]);
    } else {
      // For now, single selection; could be extended to multi-select
      selectEnvironments([envName]);
    }
  };

  return (
    <div className="px-3 py-3 border-b border-[var(--vscode-sideBar-border)]">
      <div className="flex items-center justify-between mb-2">
        <h2 className="section-header">Environment</h2>
        <Button variant="ghost" size="icon" className="h-6 w-6 ui-hover" onClick={requestEnvironments}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
      <Select
        value={activeEnvironments[0] || 'none'}
        onValueChange={handleEnvChange}
      >
        <SelectTrigger className="w-full h-9 rounded-md">
          <SelectValue placeholder="Select environment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No Environment</SelectItem>
          {environments.map((env) => (
            <SelectItem key={env.name} value={env.name}>
              {env.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--vscode-descriptionForeground)]">
        <span className="ui-chip">变量 {activeVarCount}</span>
      </div>
    </div>
  );
};
