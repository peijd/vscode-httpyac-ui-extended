/* eslint-env browser */
import React, { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger, Button } from '@/components/ui';
import { KeyValueEditor, BodyEditor, AuthEditor, MethodSelect } from '@/components/request';
import { CodeEditor } from '@/components/common/CodeEditor';
import { ResponseViewer } from '@/components/response';
import { useStore, useEditorMessages } from '@/hooks';
import { Save, Code, Copy } from 'lucide-react';
import type { HttpRequest, KeyValue } from '@/types';
import { generateId } from '@/lib/utils';
import { parseHeaderLines, parseParamText, parseCurlHeaders, parseCurlParams, extractCurlBaseUrl } from '@/lib/importParsers';

// Declare global window property for initial request
declare global {
  interface Window {
    ['__INITIAL_REQUEST__']?: HttpRequest;
  }
}

const PRE_REQUEST_SNIPPETS = [
  {
    label: 'log',
    content: "console.log('pre-request');",
  },
  {
    label: 'set var',
    content:
      "if (typeof client !== 'undefined' && client.global && typeof response !== 'undefined') {\n  client.global.set('token', response.body?.token);\n}",
  },
  {
    label: 'sleep',
    content: 'await new Promise(resolve => setTimeout(resolve, 1000));',
  },
];

const TEST_SNIPPETS = [
  {
    label: 'assert',
    content:
      "if (typeof response !== 'undefined' && response.statusCode !== 200) {\n  throw new Error(`Expected 200, got ${response.statusCode}`);\n}",
  },
  {
    label: 'set var',
    content:
      "if (typeof client !== 'undefined' && client.global && typeof response !== 'undefined') {\n  client.global.set('token', response.body?.token);\n}",
  },
  {
    label: 'log',
    content:
      "console.log('response', typeof response !== 'undefined' ? response.statusCode : 'no response');",
  },
  {
    label: 'sleep',
    content: 'await new Promise(resolve => setTimeout(resolve, 1000));',
  },
];

export const EditorApp: React.FC = () => {
  const {
    currentRequest,
    currentResponse,
    isLoading,
    error,
    requestText,
    requestTextRequestId,
    clearRequestText,
    updateRequest,
    setCurrentRequest,
    setMethod,
    setUrl,
    addParam,
    updateParam,
    removeParam,
    addHeader,
    updateHeader,
    removeHeader,
    setAuth,
    setBodyType,
    setBodyContent,
    addMeta,
    updateMeta,
    removeMeta,
    setPreRequestScript,
    setTestScript,
    setError,
    activeEnvironments,
  } = useStore();

  const {
    sendRequest,
    saveRequest,
    saveToHttpFile,
    appendToHttpFile,
    notifyReady,
    openSourceLocation,
    attachToHttpFile,
    getRequestText,
  } = useEditorMessages();
  const [splitRatio, setSplitRatio] = useState(50); // percentage for request panel
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pendingRequestTextId, setPendingRequestTextId] = useState<string | null>(null);
  const [pendingRequestTextAction, setPendingRequestTextAction] = useState<'preview' | 'copy' | null>(null);
  const [requestTextLoading, setRequestTextLoading] = useState(false);
  const [requestCopyFeedback, setRequestCopyFeedback] = useState('');
  const [responseCopyFeedback, setResponseCopyFeedback] = useState('');
  const [metaMode, setMetaMode] = useState<'quick' | 'advanced'>('quick');
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [requestTab, setRequestTab] = useState<'meta' | 'params' | 'auth' | 'headers' | 'body' | 'scripts'>('params');
  const [scriptTab, setScriptTab] = useState<'pre' | 'post'>('pre');
  const isMac = navigator.platform.toLowerCase().includes('mac');
  const source = currentRequest.source;
  const sourceFileName = source?.filePath ? source.filePath.split(/[/\\\\]/u).pop() || source.filePath : '';
  const hasEndLine =
    source?.regionEndLine !== undefined &&
    source?.regionStartLine !== undefined &&
    source.regionEndLine !== source.regionStartLine;
  const sourceLine =
    source?.regionStartLine !== undefined
      ? `L${source.regionStartLine + 1}${hasEndLine ? `-${source.regionEndLine! + 1}` : ''}`
      : '';

  // Initialize on mount and load initial request if present
  useEffect(() => {
    // Check for initial request embedded in HTML
    const initialRequest = window['__INITIAL_REQUEST__'];
    if (initialRequest) {
      console.log('[EditorApp] Loading initial request:', initialRequest);
      setCurrentRequest(initialRequest);
      // Clear it so it doesn't reload on re-render
      delete window['__INITIAL_REQUEST__'];
    }
    
    notifyReady();
  }, [notifyReady, setCurrentRequest]);

  useEffect(() => {
    if (!pendingRequestTextId || requestTextRequestId !== pendingRequestTextId || requestText === null) {
      return;
    }
    if (pendingRequestTextAction === 'copy') {
      navigator.clipboard.writeText(requestText);
      setRequestCopyFeedback('Request copied');
      window.setTimeout(() => setRequestCopyFeedback(''), 1500);
      clearRequestText();
    } else if (pendingRequestTextAction === 'preview') {
      setPreviewOpen(true);
    }
    setRequestTextLoading(false);
    setPendingRequestTextId(null);
    setPendingRequestTextAction(null);
  }, [
    pendingRequestTextId,
    requestTextRequestId,
    requestText,
    pendingRequestTextAction,
    clearRequestText,
  ]);

  const handleSend = () => {
    if (currentRequest.url) {
      setLastSentAt(Date.now());
      sendRequest();
    }
  };

  const handleBodyChange = (body: typeof currentRequest.body) => {
    setBodyType(body.type);
    setBodyContent(body.content);
  };

  const handleSave = () => {
    if (currentRequest.source?.filePath) {
      saveRequest();
      return;
    }
    saveToHttpFile();
  };

  const requestPreview = (action: 'preview' | 'copy') => {
    const requestId = getRequestText(currentRequest);
    setPendingRequestTextId(requestId);
    setPendingRequestTextAction(action);
    setRequestTextLoading(true);
    if (action === 'preview') {
      setPreviewOpen(true);
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    clearRequestText();
    setRequestTextLoading(false);
    setPendingRequestTextId(null);
    setPendingRequestTextAction(null);
  };

  const metaItems = useMemo(() => currentRequest.meta || [], [currentRequest.meta]);

  const normalizeMetaKey = (key: string) => key.replace(/^@/u, '').trim().toLowerCase();
  const findMetaIndex = (key: string) =>
    metaItems.findIndex(item => normalizeMetaKey(item.key) === normalizeMetaKey(key));

  const getMetaValue = (key: string) => {
    const index = findMetaIndex(key);
    return index >= 0 ? metaItems[index].value : '';
  };

  const isMetaEnabled = (key: string) => {
    const index = findMetaIndex(key);
    return index >= 0 ? metaItems[index].enabled : false;
  };

  const upsertMeta = (key: string, value: string, enabled = true) => {
    const normalizedKey = key.startsWith('@') ? key : `@${key}`;
    const nextMeta = [...metaItems];
    const index = findMetaIndex(key);
    if (!value && !enabled) {
      if (index >= 0) {
        nextMeta.splice(index, 1);
        updateRequest({ meta: nextMeta });
      }
      return;
    }
    if (index >= 0) {
      nextMeta[index] = { ...nextMeta[index], key: normalizedKey, value, enabled };
    } else {
      nextMeta.push({
        id: generateId(),
        key: normalizedKey,
        value,
        enabled,
      });
    }
    const updates: Partial<HttpRequest> = { meta: nextMeta };
    if (normalizeMetaKey(key) === 'name' && value.trim()) {
      updates.name = value.trim();
    }
    updateRequest(updates);
  };

  const mergeKeyValues = (
    existing: KeyValue[],
    incoming: Array<{ key: string; value: string }>,
    caseInsensitive = false
  ): KeyValue[] => {
    const result = [...existing];
    const matcher = (key: string) => (caseInsensitive ? key.trim().toLowerCase() : key.trim());
    for (const pair of incoming) {
      const incomingKey = matcher(pair.key);
      if (!incomingKey) {
        continue;
      }
      const index = result.findIndex(item => matcher(item.key) === incomingKey);
      if (index >= 0) {
        result[index] = { ...result[index], value: pair.value, enabled: true };
      } else {
        result.push({
          id: generateId(),
          key: pair.key,
          value: pair.value,
          enabled: true,
        });
      }
    }
    return result;
  };

  const toggleAllParams = (enabled: boolean) => {
    updateRequest({
      params: currentRequest.params.map(param => ({ ...param, enabled })),
    });
  };

  const toggleAllHeaders = (enabled: boolean) => {
    updateRequest({
      headers: currentRequest.headers.map(header => ({ ...header, enabled })),
    });
  };

  const importParams = async (mode: 'paste' | 'curl') => {
    try {
      const text = await navigator.clipboard.readText();
      const pairs = mode === 'curl' ? parseCurlParams(text) : parseParamText(text);
      if (pairs.length === 0) {
        setError('No params parsed. Check clipboard content.');
        return;
      }
      if (mode === 'curl') {
        const baseUrl = extractCurlBaseUrl(text);
        if (baseUrl) {
          setUrl(baseUrl);
        }
      }
      updateRequest({
        params: mergeKeyValues(currentRequest.params, pairs, false),
      });
      setError(null);
    } catch {
      setError('Failed to read clipboard. Check permissions.');
    }
  };

  const importHeaders = async (mode: 'paste' | 'curl') => {
    try {
      const text = await navigator.clipboard.readText();
      const pairs = mode === 'curl' ? parseCurlHeaders(text) : parseHeaderLines(text);
      if (pairs.length === 0) {
        setError('No headers parsed. Check clipboard content.');
        return;
      }
      updateRequest({
        headers: mergeKeyValues(currentRequest.headers, pairs, true),
      });
      setError(null);
    } catch {
      setError('Failed to read clipboard. Check permissions.');
    }
  };

  const appendSnippet = (current: string | undefined, snippet: string) => {
    const base = current?.trimEnd() || '';
    return base ? `${base}\n\n${snippet}` : snippet;
  };

  const scriptMenu = [
    {
      id: 'pre',
      label: 'Pre-request',
      description: 'Runs before request',
      hasContent: Boolean(currentRequest.preRequestScript?.trim()),
    },
    {
      id: 'post',
      label: 'Post-request',
      description: 'Runs after response',
      hasContent: Boolean(currentRequest.testScript?.trim()),
    },
  ] as const;

  const activeScript =
    scriptTab === 'pre'
      ? {
          title: 'Pre-request Script',
          value: currentRequest.preRequestScript || '',
          placeholder: '// Runs before request\n',
          description: '在发送请求前执行，可用于准备变量或设置环境。',
          snippets: PRE_REQUEST_SNIPPETS,
          onChange: setPreRequestScript,
        }
      : {
          title: 'Post-request Script',
          value: currentRequest.testScript || '',
          placeholder: '// Runs after response\n',
          description: '在收到响应后执行，可用于断言与变量提取。',
          snippets: TEST_SNIPPETS,
          onChange: setTestScript,
        };

  const scriptStats = useMemo(() => {
    const content = activeScript.value || '';
    const trimmed = content.trim();
    const lines = trimmed ? trimmed.split(/\r?\n/u).length : 0;
    return {
      lines,
      chars: content.length,
      empty: !trimmed,
    };
  }, [activeScript.value]);

  const handleCopyResponse = () => {
    if (!currentResponse) {
      setResponseCopyFeedback('No response to copy.');
      window.setTimeout(() => setResponseCopyFeedback(''), 1500);
      return;
    }
    const headerText = Object.entries(currentResponse.headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    const content = `${headerText}\n\n${currentResponse.body || ''}`.trim();
    navigator.clipboard.writeText(content);
    setResponseCopyFeedback('Response copied');
    window.setTimeout(() => setResponseCopyFeedback(''), 1500);
  };

  const formatLastSent = (timestamp: number | null) => {
    if (!timestamp) {
      return 'Not sent';
    }
    const diff = Date.now() - timestamp;
    if (diff < 60 * 1000) {
      return 'Just now';
    }
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const currentTags = useMemo(() => {
    const tagValue = getMetaValue('tag');
    if (!tagValue) {
      return [];
    }
    return tagValue.split(',').map(tag => tag.trim()).filter(Boolean);
  }, [metaItems]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const hasMod = isMac ? event.metaKey : event.ctrlKey;

      if (hasMod && event.key === 'Enter') {
        event.preventDefault();
        handleSend();
        return;
      }
      if (hasMod && key === 's') {
        event.preventDefault();
        handleSave();
        return;
      }
      if (hasMod && event.shiftKey && key === 'c') {
        event.preventDefault();
        requestPreview('copy');
        return;
      }
      if (hasMod && event.shiftKey && key === 'r') {
        event.preventDefault();
        handleCopyResponse();
        return;
      }
      if (event.altKey && !hasMod && !event.shiftKey) {
        const tabMap: Array<typeof requestTab> = ['meta', 'params', 'auth', 'headers', 'body', 'scripts'];
        const index = Number.parseInt(event.key, 10) - 1;
        if (!Number.isNaN(index) && tabMap[index]) {
          event.preventDefault();
          setRequestTab(tabMap[index]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [handleSave, handleSend, handleCopyResponse, requestPreview]);

  return (
    <div className="flex flex-col h-screen bg-[var(--vscode-editor-background)]">
      {/* Top bar: Method + URL + Send */}
      <div className="ui-topbar">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2 flex-1 ui-card px-2 py-1.5">
            <MethodSelect value={currentRequest.method} onChange={setMethod} />
            <input
              type="text"
              value={currentRequest.url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter request URL"
              className="flex-1 bg-transparent border border-transparent focus:border-[var(--vscode-focusBorder)] rounded px-2 py-1.5 text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && currentRequest.url) {
                  handleSend();
                }
              }}
            />
          </div>
          <div className="flex items-center gap-2 ui-card px-2 py-1.5">
            <input
              value={getMetaValue('name')}
              onChange={(e) => {
                const value = e.target.value;
                upsertMeta('name', value, value.trim().length > 0);
              }}
              placeholder="Request name"
              className="w-32 bg-transparent border border-transparent focus:border-[var(--vscode-focusBorder)] rounded px-2 py-1 text-xs text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
            />
            <input
              value={getMetaValue('tag')}
              onChange={(e) => {
                const value = e.target.value;
                upsertMeta('tag', value, value.trim().length > 0);
              }}
              placeholder="Tag"
              className="w-28 bg-transparent border border-transparent focus:border-[var(--vscode-focusBorder)] rounded px-2 py-1 text-xs text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)]"
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={isLoading || !currentRequest.url}
            title={`Send (${isMac ? '⌘↵' : 'Ctrl+Enter'})`}
            className="px-6 py-2.5 bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] text-[var(--vscode-button-foreground)] font-medium ui-hover"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </Button>
          <div className="flex items-center gap-1 pl-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSave}
              title={`${currentRequest.source?.filePath ? 'Save to source .http' : 'Save as .http'} (${isMac ? '⌘S' : 'Ctrl+S'})`}
              className="h-9 w-9 ui-hover"
            >
              <Save className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Preview request text"
              className="h-9 w-9 ui-hover"
              onClick={() => requestPreview('preview')}
            >
              <Code className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title={`Copy request (${isMac ? '⌘⇧C' : 'Ctrl+Shift+C'})`}
              className="h-9 w-9 ui-hover"
              onClick={() => requestPreview('copy')}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Source info */}
      <div className="ui-subbar px-4 py-2 text-xs text-[var(--vscode-descriptionForeground)] flex flex-wrap items-center justify-between gap-4">
        {source?.filePath ? (
          <div className="flex items-center gap-3 min-w-0">
            <span className="truncate ui-chip" title={source.filePath}>
              {sourceFileName}
            </span>
            {sourceLine ? (
              <span className="ui-chip">
                {sourceLine}
              </span>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] ui-hover"
              onClick={() =>
                openSourceLocation(
                  source.filePath!,
                  source.regionStartLine,
                  source.regionEndLine,
                  source.sourceHash,
                  source.regionSymbolName
                )
              }
            >
              Open source file
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="ui-chip">
              Unsaved request
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] ui-hover"
              onClick={() => saveToHttpFile()}
            >
              Save as new file
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] ui-hover"
              onClick={() => attachToHttpFile(currentRequest)}
            >
              Attach to existing .http
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="ui-chip truncate">
            {currentRequest.name || `${currentRequest.method} ${currentRequest.url}`}
          </span>
          <span className="ui-chip">
            Env {activeEnvironments.length > 0 ? activeEnvironments.join(', ') : 'Default'}
          </span>
          <span className="ui-chip">
            Tags {currentTags.length > 0 ? currentTags.join(', ') : 'None'}
          </span>
          <span className="ui-chip">
            Last sent {formatLastSent(lastSentAt)}
          </span>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-[var(--vscode-inputValidation-errorBackground)] border-b border-[var(--vscode-inputValidation-errorBorder)] text-[var(--vscode-inputValidation-errorForeground)] text-sm">
          {error}
        </div>
      )}

      {requestCopyFeedback || responseCopyFeedback ? (
        <div className="ui-subbar px-4 py-1 text-xs text-[var(--vscode-descriptionForeground)]">
          {requestCopyFeedback || responseCopyFeedback}
        </div>
      ) : null}

      {/* Main content: Request (top) + Response (bottom) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Request panel */}
        <div 
          className="flex flex-col overflow-hidden border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)]"
          style={{ height: `${splitRatio}%` }}
        >
          <Tabs value={requestTab} onValueChange={(v) => setRequestTab(v as typeof requestTab)} className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 pt-2 flex items-center justify-between gap-3">
              <TabsList className="pro-tabs w-full justify-start border-b-0">
                <TabsTrigger value="meta" className="pro-tab">
                Meta
                {(currentRequest.meta || []).filter(m => m.enabled && m.key).length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
                    {(currentRequest.meta || []).filter(m => m.enabled && m.key).length}
                  </span>
                )}
                </TabsTrigger>
                <TabsTrigger value="params" className="pro-tab">
                Params
                {currentRequest.params.filter(p => p.enabled && p.key).length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
                    {currentRequest.params.filter(p => p.enabled && p.key).length}
                  </span>
                )}
                </TabsTrigger>
                <TabsTrigger value="auth" className="pro-tab">
                Authorization
                </TabsTrigger>
                <TabsTrigger value="headers" className="pro-tab">
                Headers
                {currentRequest.headers.filter(h => h.enabled && h.key).length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
                    {currentRequest.headers.filter(h => h.enabled && h.key).length}
                  </span>
                )}
                </TabsTrigger>
                <TabsTrigger value="body" className="pro-tab">
                Body
                </TabsTrigger>
                <TabsTrigger value="scripts" className="pro-tab">
                Scripts
                </TabsTrigger>
              </TabsList>
              <span className="text-[10px] text-[var(--vscode-descriptionForeground)] whitespace-nowrap">
                Tabs: Alt+1~6
              </span>
            </div>

            <div className="flex-1 overflow-auto">
              <TabsContent value="meta" className="m-0 p-4 h-full">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-medium text-[var(--vscode-descriptionForeground)]">
                    Common Meta
                  </div>
                  <div className="flex rounded overflow-hidden border border-[var(--vscode-input-border)]">
                    {(['quick', 'advanced'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setMetaMode(mode)}
                        className={`px-3 py-1 text-xs capitalize ${
                          metaMode === mode
                            ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
                            : 'bg-[var(--vscode-input-background)] text-[var(--vscode-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]'
                        }`}
                      >
                        {mode === 'quick' ? 'Quick' : 'Advanced'}
                      </button>
                    ))}
                  </div>
                </div>

                {metaMode === 'quick' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--vscode-descriptionForeground)]">@name</label>
                      <input
                        value={getMetaValue('name')}
                        onChange={(e) => {
                          const value = e.target.value;
                          upsertMeta('name', value, value.trim().length > 0);
                        }}
                        placeholder="Request name"
                        className="w-full px-3 py-2 bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--vscode-descriptionForeground)]">@tag</label>
                      <input
                        value={getMetaValue('tag')}
                        onChange={(e) => {
                          const value = e.target.value;
                          upsertMeta('tag', value, value.trim().length > 0);
                        }}
                        placeholder="Tags (comma-separated)"
                        className="w-full px-3 py-2 bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--vscode-descriptionForeground)]">@timeout</label>
                      <input
                        value={getMetaValue('timeout')}
                        onChange={(e) => {
                          const value = e.target.value;
                          upsertMeta('timeout', value, value.trim().length > 0);
                        }}
                        placeholder="ms"
                        className="w-full px-3 py-2 bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--vscode-descriptionForeground)]">@disabled</label>
                      <div className="flex items-center gap-2 h-9">
                        <input
                          type="checkbox"
                          checked={isMetaEnabled('disabled')}
                          onChange={(e) => upsertMeta('disabled', '', e.target.checked)}
                          className="h-4 w-4 cursor-pointer accent-[var(--vscode-focusBorder)]"
                        />
                        <span className="text-xs text-[var(--vscode-descriptionForeground)]">Disable this request</span>
                      </div>
                    </div>
                    <div className="col-span-2 text-xs text-[var(--vscode-descriptionForeground)]">
                      Examples: @name / @tag / @timeout / @disabled. Switch to Advanced to edit any meta.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <KeyValueEditor
                      items={currentRequest.meta || []}
                      onAdd={addMeta}
                      onUpdate={updateMeta}
                      onRemove={removeMeta}
                      onItemsChange={(items) => updateRequest({ meta: items })}
                      keyPlaceholder="@key"
                      valuePlaceholder="value"
                    />
                    <p className="text-xs text-[var(--vscode-descriptionForeground)]">
                      Examples: @name / @tag / @timeout / @disabled. Values can be empty.
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="params" className="m-0 p-4 h-full">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => toggleAllParams(true)}
                    >
                      Enable all
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => toggleAllParams(false)}
                    >
                      Disable all
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => importParams('paste')}
                    >
                      Paste to parse
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => importParams('curl')}
                    >
                      Import curl
                    </Button>
                  </div>
                </div>
                <KeyValueEditor
                  items={currentRequest.params}
                  onAdd={addParam}
                  onUpdate={updateParam}
                  onRemove={removeParam}
                  onItemsChange={(items) => updateRequest({ params: items })}
                  keyPlaceholder="Parameter name"
                  valuePlaceholder="Parameter value"
                />
              </TabsContent>

              <TabsContent value="auth" className="m-0 p-4 h-full">
                <AuthEditor auth={currentRequest.auth} onChange={setAuth} />
              </TabsContent>

              <TabsContent value="headers" className="m-0 p-4 h-full">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => toggleAllHeaders(true)}
                    >
                      Enable all
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => toggleAllHeaders(false)}
                    >
                      Disable all
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => importHeaders('paste')}
                    >
                      Paste to parse
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => importHeaders('curl')}
                    >
                      Import curl
                    </Button>
                  </div>
                </div>
                <KeyValueEditor
                  items={currentRequest.headers}
                  onAdd={addHeader}
                  onUpdate={updateHeader}
                  onRemove={removeHeader}
                  onItemsChange={(items) => updateRequest({ headers: items })}
                  keyPlaceholder="Header name"
                  valuePlaceholder="Header value"
                />
              </TabsContent>

              <TabsContent value="body" className="m-0 p-4 h-full">
                <BodyEditor body={currentRequest.body} onChange={handleBodyChange} />
              </TabsContent>

              <TabsContent value="scripts" className="m-0 p-4 h-full">
                <div className="flex h-full gap-4">
                  <div className="w-52 shrink-0 flex flex-col gap-3">
                    <div className="text-[10px] uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
                      Scripts
                    </div>
                    <div className="ui-card p-2 space-y-1">
                      {scriptMenu.map(item => {
                        const active = scriptTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => setScriptTab(item.id)}
                            className={`w-full text-left px-3 py-2 rounded border text-xs transition-colors ${
                              active
                                ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)] border-[var(--vscode-focusBorder)]'
                                : 'bg-[var(--vscode-editor-background)] text-[var(--vscode-foreground)] border-[var(--vscode-input-border)] hover:bg-[var(--vscode-list-hoverBackground)]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{item.label}</span>
                              {item.hasContent ? (
                                <span
                                  className={`text-[10px] ${
                                    active ? 'opacity-90' : 'text-[var(--vscode-descriptionForeground)]'
                                  }`}
                                >
                                  ●
                                </span>
                              ) : null}
                            </div>
                            <div
                              className={`text-[10px] ${
                                active ? 'opacity-90' : 'text-[var(--vscode-descriptionForeground)]'
                              }`}
                            >
                              {item.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="ui-card p-3 text-[10px] text-[var(--vscode-descriptionForeground)] space-y-1">
                      <div>脚本将被写入 .http 的 &gt; {'{% %}'} 块。</div>
                      <div>支持 console.log 输出运行日志。</div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col min-h-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="space-y-0.5">
                        <div className="text-xs font-medium text-[var(--vscode-descriptionForeground)]">
                          {activeScript.title}
                        </div>
                        <div className="text-[10px] text-[var(--vscode-descriptionForeground)]">
                          {activeScript.description}
                        </div>
                      </div>
                      <div className="text-[10px] text-[var(--vscode-descriptionForeground)] whitespace-nowrap">
                        行 {scriptStats.lines} · 字符 {scriptStats.chars}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="text-[10px] text-[var(--vscode-descriptionForeground)]">
                        {scriptStats.empty ? '暂无脚本，先从片段开始。' : '可从片段快速补全常用逻辑。'}
                      </div>
                      <div className="flex items-center gap-1 overflow-x-auto">
                        {activeScript.snippets.map(snippet => (
                          <Button
                            key={snippet.label}
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => activeScript.onChange(appendSnippet(activeScript.value, snippet.content))}
                          >
                            {snippet.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1 min-h-0">
                      <CodeEditor
                        value={activeScript.value}
                        language="javascript"
                        placeholder={activeScript.placeholder}
                        onChange={activeScript.onChange}
                        minHeight={320}
                        fill
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Resize handle */}
        <div 
          className="h-1 cursor-row-resize bg-[var(--vscode-panel-border)] hover:bg-[var(--vscode-focusBorder)] transition-colors"
          onMouseDown={(e) => {
            e.preventDefault();
            const startY = e.clientY;
            const startRatio = splitRatio;
            const container = e.currentTarget.parentElement;
            if (!container) return;
            
            const handleMouseMove = (moveEvent: MouseEvent) => {
              const containerHeight = container.clientHeight;
              const deltaY = moveEvent.clientY - startY;
              const deltaRatio = (deltaY / containerHeight) * 100;
              const newRatio = Math.min(80, Math.max(20, startRatio + deltaRatio));
              setSplitRatio(newRatio);
            };
            
            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
        />

        {/* Response panel */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {currentResponse ? (
            <ResponseViewer
              response={currentResponse}
              request={currentRequest}
              onSaveSnippet={() => saveToHttpFile(currentRequest)}
              onAppendSnippet={() => appendToHttpFile(currentRequest)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--vscode-descriptionForeground)]">
              <div className="text-center">
                <p className="text-base mb-1 opacity-60">This request does not have a response</p>
                <p className="text-sm opacity-40">Click Send to get a response</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {previewOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6">
          <div className="w-full max-w-3xl ui-card shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-tab-inactiveBackground)]">
              <div className="text-sm font-medium text-[var(--vscode-foreground)]">Request preview</div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-3 text-xs ui-hover"
                  onClick={() => {
                    if (requestText) {
                      navigator.clipboard.writeText(requestText);
                      setRequestCopyFeedback('Request copied');
                      window.setTimeout(() => setRequestCopyFeedback(''), 1500);
                    }
                  }}
                >
                  Copy
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-3 text-xs ui-hover" onClick={closePreview}>
                  Close
                </Button>
              </div>
            </div>
            <div className="p-4 max-h-[70vh] overflow-auto">
              {requestTextLoading ? (
                <div className="text-sm text-[var(--vscode-descriptionForeground)]">Generating...</div>
              ) : (
                <pre className="code-area text-sm whitespace-pre-wrap">{requestText}</pre>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
