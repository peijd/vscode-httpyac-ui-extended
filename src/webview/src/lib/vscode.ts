import type { Message, VsCodeApi } from '@/types';

// Acquire VSCode API once
let vscode: VsCodeApi | undefined;

export function getVsCodeApi(): VsCodeApi {
  if (!vscode) {
    if (typeof window !== 'undefined' && window.acquireVsCodeApi) {
      vscode = window.acquireVsCodeApi();
    } else {
      // Mock for development outside VSCode
      console.warn('VSCode API not available, using mock');
      vscode = {
        postMessage: (message: Message) => {
          console.log('Mock postMessage:', message);
        },
        getState: () => null,
        setState: (state: unknown) => {
          console.log('Mock setState:', state);
        },
      };
    }
  }
  return vscode;
}

export function postMessage<T>(type: Message['type'], payload?: T, requestId?: string): void {
  const api = getVsCodeApi();
  api.postMessage({ type, payload, requestId });
}

export function saveState<T>(state: T): void {
  const api = getVsCodeApi();
  api.setState(state);
}

export function getState<T>(): T | null {
  const api = getVsCodeApi();
  return api.getState() as T | null;
}

// Message listener management
type MessageHandler = (message: Message) => void;
const handlers = new Set<MessageHandler>();

export function addMessageListener(handler: MessageHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

// Initialize message listener
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event: MessageEvent<Message>) => {
    const message = event.data;
    handlers.forEach(handler => handler(message));
  });
}

