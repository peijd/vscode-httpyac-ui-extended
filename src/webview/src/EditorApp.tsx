import React, { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger, Button } from '@/components/ui';
import { KeyValueEditor, BodyEditor, AuthEditor, MethodSelect } from '@/components/request';
import { ResponseViewer } from '@/components/response';
import { useStore, useVsCodeMessages } from '@/hooks';
import { Save, Code } from 'lucide-react';
import type { HttpRequest } from '@/types';

// Declare global window property for initial request
declare global {
  interface Window {
    __INITIAL_REQUEST__?: HttpRequest;
  }
}

export const EditorApp: React.FC = () => {
  const {
    currentRequest,
    currentResponse,
    isLoading,
    error,
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
  } = useStore();

  const { sendRequest, saveRequest, saveToHttpFile, notifyReady, openSourceLocation, attachToHttpFile } = useVsCodeMessages();
  const [splitRatio, setSplitRatio] = useState(50); // percentage for request panel
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
    if (window.__INITIAL_REQUEST__) {
      console.log('[EditorApp] Loading initial request:', window.__INITIAL_REQUEST__);
      setCurrentRequest(window.__INITIAL_REQUEST__);
      // Clear it so it doesn't reload on re-render
      delete window.__INITIAL_REQUEST__;
    }
    
    notifyReady();
  }, [notifyReady, setCurrentRequest]);

  const handleSend = () => {
    if (currentRequest.url) {
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

  return (
    <div className="flex flex-col h-screen bg-[var(--vscode-editor-background)]">
      {/* Top bar: Method + URL + Send */}
      <div className="flex items-center gap-2 p-3 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)]">
        <MethodSelect value={currentRequest.method} onChange={setMethod} />
        <input
          type="text"
          value={currentRequest.url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter request URL"
          className="flex-1 px-3 py-2 bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded text-[var(--vscode-input-foreground)] placeholder:text-[var(--vscode-input-placeholderForeground)] focus:outline-none focus:border-[var(--vscode-focusBorder)]"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && currentRequest.url) {
              handleSend();
            }
          }}
        />
        <Button
          onClick={handleSend}
          disabled={isLoading || !currentRequest.url}
          className="px-6 py-2 bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] text-[var(--vscode-button-foreground)] font-medium"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </Button>
        <div className="flex items-center gap-1 border-l border-[var(--vscode-panel-border)] pl-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSave}
            title={currentRequest.source?.filePath ? 'Save to source .http file' : 'Save to .http file'}
            className="h-9 w-9"
          >
            <Save className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="View as Code (coming soon)"
            className="h-9 w-9"
          >
            <Code className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Source info */}
      <div className="px-4 py-2 border-b border-[var(--vscode-panel-border)] text-xs text-[var(--vscode-descriptionForeground)] flex items-center justify-between gap-4">
        {source?.filePath ? (
          <div className="flex items-center gap-3 min-w-0">
            <span className="truncate" title={source.filePath}>
              文件：{sourceFileName}
            </span>
            {sourceLine ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-[var(--vscode-panel-border)]">
                {sourceLine}
              </span>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => openSourceLocation(source.filePath!, source.regionStartLine, source.regionEndLine)}
            >
              跳转源文件
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-[var(--vscode-panel-border)]">
              临时请求
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => saveToHttpFile()}
            >
              保存为新文件
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => attachToHttpFile(currentRequest)}
            >
              关联到已有 .http
            </Button>
          </div>
        )}
        <div className="truncate">
          请求标识：{currentRequest.name || `${currentRequest.method} ${currentRequest.url}`}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-[var(--vscode-inputValidation-errorBackground)] border-b border-[var(--vscode-inputValidation-errorBorder)] text-[var(--vscode-inputValidation-errorForeground)] text-sm">
          {error}
        </div>
      )}

      {/* Main content: Request (top) + Response (bottom) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Request panel */}
        <div 
          className="flex flex-col overflow-hidden border-b border-[var(--vscode-panel-border)]"
          style={{ height: `${splitRatio}%` }}
        >
          <Tabs defaultValue="params" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="px-3 shrink-0 justify-start bg-[var(--vscode-tab-inactiveBackground)] border-b border-[var(--vscode-panel-border)]">
              <TabsTrigger value="meta" className="data-[state=active]:bg-[var(--vscode-tab-activeBackground)]">
                Meta
                {(currentRequest.meta || []).filter(m => m.enabled && m.key).length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
                    {(currentRequest.meta || []).filter(m => m.enabled && m.key).length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="params" className="data-[state=active]:bg-[var(--vscode-tab-activeBackground)]">
                Params
                {currentRequest.params.filter(p => p.enabled && p.key).length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
                    {currentRequest.params.filter(p => p.enabled && p.key).length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="auth" className="data-[state=active]:bg-[var(--vscode-tab-activeBackground)]">
                Authorization
              </TabsTrigger>
              <TabsTrigger value="headers" className="data-[state=active]:bg-[var(--vscode-tab-activeBackground)]">
                Headers
                {currentRequest.headers.filter(h => h.enabled && h.key).length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
                    {currentRequest.headers.filter(h => h.enabled && h.key).length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="body" className="data-[state=active]:bg-[var(--vscode-tab-activeBackground)]">
                Body
              </TabsTrigger>
              <TabsTrigger value="scripts" className="data-[state=active]:bg-[var(--vscode-tab-activeBackground)]">
                Scripts
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto">
              <TabsContent value="meta" className="m-0 p-4 h-full">
                <KeyValueEditor
                  items={currentRequest.meta || []}
                  onAdd={addMeta}
                  onUpdate={updateMeta}
                  onRemove={removeMeta}
                  keyPlaceholder="@key"
                  valuePlaceholder="value"
                />
                <p className="text-xs text-[var(--vscode-descriptionForeground)] mt-2">
                  示例：@name / @tag / @timeout / @disabled 等。值可为空。
                </p>
              </TabsContent>

              <TabsContent value="params" className="m-0 p-4 h-full">
                <KeyValueEditor
                  items={currentRequest.params}
                  onAdd={addParam}
                  onUpdate={updateParam}
                  onRemove={removeParam}
                  keyPlaceholder="Parameter name"
                  valuePlaceholder="Parameter value"
                />
              </TabsContent>

              <TabsContent value="auth" className="m-0 p-4 h-full">
                <AuthEditor auth={currentRequest.auth} onChange={setAuth} />
              </TabsContent>

              <TabsContent value="headers" className="m-0 p-4 h-full">
                <KeyValueEditor
                  items={currentRequest.headers}
                  onAdd={addHeader}
                  onUpdate={updateHeader}
                  onRemove={removeHeader}
                  keyPlaceholder="Header name"
                  valuePlaceholder="Header value"
                />
              </TabsContent>

              <TabsContent value="body" className="m-0 p-4 h-full">
                <BodyEditor body={currentRequest.body} onChange={handleBodyChange} />
              </TabsContent>

              <TabsContent value="scripts" className="m-0 p-4 h-full">
                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-medium text-[var(--vscode-descriptionForeground)] mb-2">
                      Pre-request Script
                    </div>
                    <textarea
                      value={currentRequest.preRequestScript || ''}
                      onChange={(e) => setPreRequestScript(e.target.value)}
                      placeholder="在请求前执行的脚本（JS）"
                      className="code-area w-full min-h-[140px]"
                      spellCheck={false}
                    />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[var(--vscode-descriptionForeground)] mb-2">
                      Test Script
                    </div>
                    <textarea
                      value={currentRequest.testScript || ''}
                      onChange={(e) => setTestScript(e.target.value)}
                      placeholder="在响应后执行的测试脚本（JS）"
                      className="code-area w-full min-h-[160px]"
                      spellCheck={false}
                    />
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
            <ResponseViewer response={currentResponse} />
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
    </div>
  );
};
