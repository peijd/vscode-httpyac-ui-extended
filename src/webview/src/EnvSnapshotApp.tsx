import React, { useEffect, useMemo, useState } from 'react';
import { addMessageListener, postMessage } from '@/lib/vscode';
import { Button, ScrollArea, Separator } from '@/components/ui';
import type { EnvironmentSnapshot, EnvironmentSnapshotEntry } from '@/types';

function formatTime(value?: number): string {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString();
}

function renderKeyValues(vars: Record<string, string> | undefined): React.ReactNode {
  const entries = vars ? Object.entries(vars) : [];
  if (entries.length === 0) {
    return <div className="text-xs text-[var(--vscode-descriptionForeground)]">无</div>;
  }
  return (
    <div className="space-y-2 text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[160px_1fr] gap-2">
          <div className="font-medium break-all">{key}</div>
          <div className="text-[var(--vscode-descriptionForeground)] break-all whitespace-pre-wrap">{value}</div>
        </div>
      ))}
    </div>
  );
}

function renderEnvironment(env: EnvironmentSnapshotEntry, active: string[]): React.ReactNode {
  const isActive = active.includes(env.name);
  return (
    <div key={env.name} className="rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface-2)] p-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold">{env.name}</div>
        {isActive ? (
          <span className="rounded-full bg-[var(--vscode-badge-background)] px-2 py-0.5 text-[10px] text-[var(--vscode-badge-foreground)]">
            当前
          </span>
        ) : null}
      </div>
      <div className="mt-2">{renderKeyValues(env.variables)}</div>
    </div>
  );
}

export const EnvSnapshotApp: React.FC = () => {
  const [snapshot, setSnapshot] = useState<EnvironmentSnapshot | null>(null);

  useEffect(() => {
    const unsubscribe = addMessageListener(message => {
      if (message.type === 'environmentSnapshotUpdated') {
        setSnapshot(message.payload as EnvironmentSnapshot);
      }
    });
    postMessage('getEnvironmentSnapshot');
    return unsubscribe;
  }, []);

  const activeLabel = useMemo(() => {
    if (!snapshot?.active || snapshot.active.length === 0) {
      return '未选择环境';
    }
    return snapshot.active.join(', ');
  }, [snapshot?.active]);

  const runtimeVariables = useMemo(() => snapshot?.runtime || {}, [snapshot?.runtime]);
  const runtimeEmpty = !snapshot?.runtime || Object.keys(snapshot.runtime).length === 0;

  return (
    <div className="flex min-h-screen flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">环境快照</div>
          <div className="text-xs text-[var(--vscode-descriptionForeground)]">
            上次更新：{formatTime(snapshot?.updatedAt)}
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={() => postMessage('getEnvironmentSnapshot')}>
          刷新
        </Button>
      </div>

      <div className="rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface-2)] p-3 text-xs">
        <div className="text-[var(--vscode-descriptionForeground)]">当前环境</div>
        <div className="mt-1 font-medium">{activeLabel}</div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="text-sm font-semibold">运行时变量（含脚本设置）</div>
        <div className="rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface-2)] p-3">
          <ScrollArea className="max-h-[240px]">
            {runtimeEmpty ? (
              <div className="text-xs text-[var(--vscode-descriptionForeground)]">
                暂无运行时变量（可能尚未执行请求）
              </div>
            ) : (
              renderKeyValues(runtimeVariables)
            )}
          </ScrollArea>
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="text-sm font-semibold">环境变量</div>
        <div className="space-y-3">
          {snapshot?.environments && snapshot.environments.length > 0 ? (
            snapshot.environments.map(env => renderEnvironment(env, snapshot.active))
          ) : (
            <div className="text-xs text-[var(--vscode-descriptionForeground)]">未找到环境配置</div>
          )}
        </div>
      </div>
    </div>
  );
};
