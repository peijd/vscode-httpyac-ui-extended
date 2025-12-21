import { useEffect, useCallback } from 'react';
import { addMessageListener, postMessage } from '@/lib/vscode';
import { useStore } from './useStore';
import type { Message, HttpRequest, HttpResponse } from '@/types';
import { generateId } from '@/lib/utils';

export function useEditorMessages() {
  const {
    currentRequest,
    setCurrentRequest,
    setResponse,
    setLoading,
    setError,
    setRequestText,
    setEnvironments,
    setActiveEnvironments,
  } = useStore();

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
        case 'environmentsUpdated': {
          const envData = message.payload as {
            environments: Array<{ name: string; variables: Record<string, string> }>;
            active: string[];
          };
          setEnvironments(
            envData.environments.map((env) => ({
              ...env,
              isActive: envData.active.includes(env.name),
            }))
          );
          setActiveEnvironments(envData.active);
          break;
        }
        case 'setRequest':
          setCurrentRequest(message.payload as HttpRequest);
          break;
        default:
          break;
      }
    });

    return unsubscribe;
  }, [setResponse, setLoading, setError, setRequestText, setCurrentRequest, setEnvironments, setActiveEnvironments]);

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

  const saveToHttpFile = useCallback(
    (request?: HttpRequest) => {
      postMessage('saveToHttpFile', request || currentRequest);
    },
    [currentRequest]
  );

  const appendToHttpFile = useCallback(
    (request?: HttpRequest) => {
      postMessage('appendToHttpFile', request || currentRequest);
    },
    [currentRequest]
  );

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

  const openSourceLocation = useCallback(
    (filePath: string, line?: number, endLine?: number, sourceHash?: string, regionSymbolName?: string) => {
      postMessage('openSourceLocation', { filePath, line, endLine, sourceHash, regionSymbolName });
    },
    []
  );

  const attachToHttpFile = useCallback((request: HttpRequest) => {
    postMessage('attachToHttpFile', request);
  }, []);

  const notifyReady = useCallback(() => {
    postMessage('ready');
  }, []);

  return {
    sendRequest,
    saveToHttpFile,
    appendToHttpFile,
    saveRequest,
    getRequestText,
    openSourceLocation,
    attachToHttpFile,
    notifyReady,
  };
}
