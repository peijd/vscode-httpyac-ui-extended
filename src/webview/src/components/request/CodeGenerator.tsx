import React, { useState, useEffect, useCallback } from 'react';
import { Button, ScrollArea } from '@/components/ui';
import { CodeEditor } from '@/components/common/CodeEditor';
import { X, Copy, Check, Code } from 'lucide-react';
import type { HttpRequest } from '@/types';

interface CodeGeneratorProps {
  request: HttpRequest;
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (target: string, client: string) => void;
  generatedCode: string | null;
  isGenerating: boolean;
}

// Common language/client configurations for quick access
const QUICK_TARGETS = [
  { label: 'cURL', target: 'shell', client: 'curl', icon: '🐚' },
  { label: 'Python', target: 'python', client: 'requests', icon: '🐍' },
  { label: 'JavaScript', target: 'javascript', client: 'fetch', icon: '🟨' },
  { label: 'Node.js', target: 'node', client: 'axios', icon: '🟩' },
  { label: 'Go', target: 'go', client: 'native', icon: '🔵' },
  { label: 'Java', target: 'java', client: 'okhttp', icon: '☕' },
];

// Full list of available targets (from httpsnippet)
const ALL_TARGETS = [
  { group: 'Shell', items: [
    { label: 'cURL', target: 'shell', client: 'curl' },
    { label: 'HTTPie', target: 'shell', client: 'httpie' },
    { label: 'Wget', target: 'shell', client: 'wget' },
  ]},
  { group: 'JavaScript', items: [
    { label: 'Fetch', target: 'javascript', client: 'fetch' },
    { label: 'XMLHttpRequest', target: 'javascript', client: 'xhr' },
    { label: 'jQuery', target: 'javascript', client: 'jquery' },
  ]},
  { group: 'Node.js', items: [
    { label: 'Axios', target: 'node', client: 'axios' },
    { label: 'Fetch', target: 'node', client: 'fetch' },
    { label: 'HTTP', target: 'node', client: 'native' },
    { label: 'Request', target: 'node', client: 'request' },
    { label: 'Unirest', target: 'node', client: 'unirest' },
  ]},
  { group: 'Python', items: [
    { label: 'Requests', target: 'python', client: 'requests' },
    { label: 'http.client', target: 'python', client: 'python3' },
  ]},
  { group: 'Go', items: [
    { label: 'Native', target: 'go', client: 'native' },
  ]},
  { group: 'Java', items: [
    { label: 'OkHttp', target: 'java', client: 'okhttp' },
    { label: 'Unirest', target: 'java', client: 'unirest' },
    { label: 'AsyncHttp', target: 'java', client: 'asynchttp' },
    { label: 'NetHttp', target: 'java', client: 'nethttp' },
  ]},
  { group: 'C#', items: [
    { label: 'HttpClient', target: 'csharp', client: 'httpclient' },
    { label: 'RestSharp', target: 'csharp', client: 'restsharp' },
  ]},
  { group: 'PHP', items: [
    { label: 'cURL', target: 'php', client: 'curl' },
    { label: 'Guzzle', target: 'php', client: 'guzzle' },
    { label: 'HTTP v1', target: 'php', client: 'http1' },
    { label: 'HTTP v2', target: 'php', client: 'http2' },
  ]},
  { group: 'Ruby', items: [
    { label: 'Native', target: 'ruby', client: 'native' },
  ]},
  { group: 'Swift', items: [
    { label: 'URLSession', target: 'swift', client: 'nsurlsession' },
  ]},
  { group: 'Kotlin', items: [
    { label: 'OkHttp', target: 'kotlin', client: 'okhttp' },
  ]},
  { group: 'Objective-C', items: [
    { label: 'NSURLSession', target: 'objc', client: 'nsurlsession' },
  ]},
  { group: 'C', items: [
    { label: 'libcurl', target: 'c', client: 'libcurl' },
  ]},
  { group: 'Clojure', items: [
    { label: 'clj-http', target: 'clojure', client: 'clj_http' },
  ]},
  { group: 'R', items: [
    { label: 'httr', target: 'r', client: 'httr' },
  ]},
  { group: 'PowerShell', items: [
    { label: 'Invoke-WebRequest', target: 'powershell', client: 'webrequest' },
    { label: 'Invoke-RestMethod', target: 'powershell', client: 'restmethod' },
  ]},
  { group: 'OCaml', items: [
    { label: 'CoHTTP', target: 'ocaml', client: 'cohttp' },
  ]},
];

const getLanguageForTarget = (target: string): 'json' | 'text' | 'javascript' => {
  if (target === 'javascript' || target === 'node') {
    return 'javascript';
  }
  return 'text';
};

export const CodeGenerator: React.FC<CodeGeneratorProps> = ({
  request,
  isOpen,
  onClose,
  onGenerate,
  generatedCode,
  isGenerating,
}) => {
  const [selectedTarget, setSelectedTarget] = useState<{ target: string; client: string; label: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAllTargets, setShowAllTargets] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTarget(null);
      setCopied(false);
      setShowAllTargets(false);
    }
  }, [isOpen]);

  const handleSelectTarget = useCallback((target: string, client: string, label: string) => {
    setSelectedTarget({ target, client, label });
    onGenerate(target, client);
  }, [onGenerate]);

  const handleCopy = useCallback(() => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [generatedCode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-[80vh] flex flex-col ui-card shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-tab-inactiveBackground)]">
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            <span className="font-medium">Generate Code</span>
            {selectedTarget && (
              <span className="text-xs text-[var(--vscode-descriptionForeground)]">
                — {selectedTarget.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {generatedCode && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-3 text-xs gap-1"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Target selection */}
          <div className="w-64 shrink-0 border-r border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)] overflow-hidden flex flex-col">
            <div className="p-3 border-b border-[var(--vscode-panel-border)]">
              <div className="text-xs font-medium text-[var(--vscode-descriptionForeground)] uppercase tracking-wide mb-2">
                Quick Access
              </div>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_TARGETS.map((item) => (
                  <button
                    key={`${item.target}-${item.client}`}
                    onClick={() => handleSelectTarget(item.target, item.client, item.label)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors ${
                      selectedTarget?.target === item.target && selectedTarget?.client === item.client
                        ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
                        : 'bg-[var(--vscode-input-background)] hover:bg-[var(--vscode-list-hoverBackground)]'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-3">
                <button
                  onClick={() => setShowAllTargets(!showAllTargets)}
                  className="w-full text-left text-xs text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)] mb-2"
                >
                  {showAllTargets ? '▼' : '▶'} All Languages ({ALL_TARGETS.reduce((acc, g) => acc + g.items.length, 0)})
                </button>

                {showAllTargets && ALL_TARGETS.map((group) => (
                  <div key={group.group} className="mb-3">
                    <div className="text-[10px] font-medium text-[var(--vscode-descriptionForeground)] uppercase tracking-wide mb-1">
                      {group.group}
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map((item) => (
                        <button
                          key={`${item.target}-${item.client}`}
                          onClick={() => handleSelectTarget(item.target, item.client, `${group.group} - ${item.label}`)}
                          className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                            selectedTarget?.target === item.target && selectedTarget?.client === item.client
                              ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
                              : 'hover:bg-[var(--vscode-list-hoverBackground)]'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Right: Generated code */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {isGenerating ? (
              <div className="flex-1 flex items-center justify-center text-[var(--vscode-descriptionForeground)]">
                <div className="text-center">
                  <div className="animate-spin h-6 w-6 border-2 border-[var(--vscode-focusBorder)] border-t-transparent rounded-full mx-auto mb-2" />
                  <div className="text-sm">Generating code...</div>
                </div>
              </div>
            ) : generatedCode ? (
              <div className="flex-1 overflow-hidden p-4">
                <CodeEditor
                  value={generatedCode}
                  language={selectedTarget ? getLanguageForTarget(selectedTarget.target) : 'text'}
                  readOnly
                  fill
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[var(--vscode-descriptionForeground)]">
                <div className="text-center">
                  <Code className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <div className="text-sm mb-1">Select a language to generate code</div>
                  <div className="text-xs opacity-70">
                    Request: {request.method} {request.url || 'No URL'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
