import { useEffect, useCallback } from 'react';
import { addMessageListener, postMessage } from '@/lib/vscode';
import { useStore } from './useStore';
import type { Message, HttpRequest, HttpResponse, HistoryItem, CollectionItem } from '@/types';
import { generateId } from '@/lib/utils';

export function useVsCodeMessages() {
  const {
    currentRequest,
    setCurrentRequest,
    setResponse,
    setLoading,
    setError,
    setRequestText,
    setEnvironments,
    setActiveEnvironments,
    setHistory,
    setCollections,
  } = useStore();

  // Handle incoming messages from VSCode
  useEffect(() => {
    const unsubscribe = addMessageListener((message: Message) => {
      switch (message.type) {
        case 'requestResponse':
          setLoading(false);
          setResponse(message.payload as HttpResponse);
          break;

        case 'requestError':
          setLoading(false);
          setError(message.payload as string);
          break;
        case 'requestText': {
          const payload = message.payload as { text: string };
          setRequestText(payload?.text ?? '', message.requestId);
          break;
        }

        case 'environmentsUpdated':
          const envData = message.payload as {
            environments: Array<{ name: string; variables: Record<string, string> }>;
            active: string[];
          };
          setEnvironments(
            envData.environments.map((e) => ({
              ...e,
              isActive: envData.active.includes(e.name),
            }))
          );
          setActiveEnvironments(envData.active);
          break;

        case 'historyUpdated':
          setHistory(message.payload as HistoryItem[]);
          break;

        case 'collectionsUpdated':
          setCollections(message.payload as CollectionItem[]);
          break;

        case 'setRequest':
          console.log('[webview] Received setRequest:', message.payload);
          setCurrentRequest(message.payload as HttpRequest);
          break;

        default:
          console.log('Unhandled message:', message);
      }
    });

    return unsubscribe;
  }, [
    setResponse,
    setLoading,
    setError,
    setRequestText,
    setEnvironments,
    setActiveEnvironments,
    setHistory,
    setCollections,
    setCurrentRequest,
  ]);

  // Send request to VSCode
  const sendRequest = useCallback(
    (request?: HttpRequest) => {
      const req = request || currentRequest;
      setLoading(true);
      setError(null);
      setResponse(null);

      const requestId = generateId();
      postMessage('sendRequest', req, requestId);
    },
    [currentRequest, setLoading, setError, setResponse]
  );

  // Request environments from VSCode
  const requestEnvironments = useCallback(() => {
    postMessage('getEnvironments');
  }, []);

  // Set active environments
  const selectEnvironments = useCallback((names: string[]) => {
    postMessage('setEnvironments', names);
    setActiveEnvironments(names);
  }, [setActiveEnvironments]);

  // Request history from VSCode
  const requestHistory = useCallback(() => {
    postMessage('getHistory');
  }, []);

  // Request collections from VSCode
  const requestCollections = useCallback(() => {
    postMessage('getCollections');
  }, []);

  // Create new collection (.http file)
  const createCollection = useCallback(() => {
    postMessage('createCollection');
  }, []);

  // Save request to .http file
  const saveToHttpFile = useCallback(
    (request?: HttpRequest) => {
      postMessage('saveToHttpFile', request || currentRequest);
    },
    [currentRequest]
  );

  // Save request to source .http (fallback to Save As)
  const saveRequest = useCallback(
    (request?: HttpRequest) => {
      postMessage('saveRequest', request || currentRequest);
    },
    [currentRequest]
  );

  const getRequestText = useCallback(
    (request?: HttpRequest) => {
      const requestId = generateId();
      postMessage('getRequestText', request || currentRequest, requestId);
      return requestId;
    },
    [currentRequest]
  );

  // Open request in editor panel
  const openInEditor = useCallback((request: HttpRequest) => {
    postMessage('openInEditor', request);
  }, []);

  // Open http file
  const openHttpFile = useCallback((filePath: string) => {
    postMessage('openHttpFile', filePath);
  }, []);

  const openSourceLocation = useCallback((filePath: string, line?: number, endLine?: number) => {
    postMessage('openSourceLocation', { filePath, line, endLine });
  }, []);

  const attachToHttpFile = useCallback((request: HttpRequest) => {
    postMessage('attachToHttpFile', request);
  }, []);

  // Notify VSCode that webview is ready
  const notifyReady = useCallback(() => {
    postMessage('ready');
  }, []);

  return {
    sendRequest,
    requestEnvironments,
    selectEnvironments,
    requestHistory,
    requestCollections,
    createCollection,
    saveToHttpFile,
    saveRequest,
    getRequestText,
    openInEditor,
    openHttpFile,
    openSourceLocation,
    attachToHttpFile,
    notifyReady,
  };
}
