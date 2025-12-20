import { useEffect, useCallback } from 'react';
import { addMessageListener, postMessage } from '@/lib/vscode';
import { useStore } from './useStore';
import type { Message, HttpRequest, HttpResponse } from '@/types';
import { generateId } from '@/lib/utils';

export function useVsCodeMessages() {
  const {
    currentRequest,
    setCurrentRequest,
    setResponse,
    setLoading,
    setError,
    setEnvironments,
    setActiveEnvironments,
    setHistory,
    addToHistory,
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
          setHistory(message.payload as typeof useStore.getState extends () => infer S ? S extends { history: infer H } ? H : never : never);
          break;

        case 'collectionsUpdated':
          console.log('[webview] Received collectionsUpdated:', message.payload);
          setCollections(message.payload as typeof useStore.getState extends () => infer S ? S extends { collections: infer C } ? C : never : never);
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
  }, [setResponse, setLoading, setError, setEnvironments, setActiveEnvironments, setHistory, setCollections, setCurrentRequest]);

  // Send request to VSCode
  const sendRequest = useCallback(
    (request?: HttpRequest) => {
      const req = request || currentRequest;
      setLoading(true);
      setError(null);
      setResponse(null);

      const requestId = generateId();
      postMessage('sendRequest', req, requestId);

      // Add to history
      addToHistory({
        id: requestId,
        request: req,
        timestamp: Date.now(),
      });
    },
    [currentRequest, setLoading, setError, setResponse, addToHistory]
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

  // Save request to .http file
  const saveToHttpFile = useCallback(
    (request?: HttpRequest) => {
      postMessage('saveToHttpFile', request || currentRequest);
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
    saveToHttpFile,
    openInEditor,
    openHttpFile,
    notifyReady,
  };
}

