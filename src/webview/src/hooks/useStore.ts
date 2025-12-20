import { create } from 'zustand';
import type { AppState, HttpRequest, HttpResponse, Environment, HistoryItem, CollectionItem, KeyValue } from '@/types';
import { generateId } from '@/lib/utils';

// Create a default empty request
function createDefaultRequest(): HttpRequest {
  return {
    id: generateId(),
    name: 'New Request',
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    auth: { type: 'none' },
    body: { type: 'none', content: '' },
  };
}

// Create default key-value
export function createKeyValue(key = '', value = ''): KeyValue {
  return {
    id: generateId(),
    key,
    value,
    enabled: true,
  };
}

interface StoreActions {
  // Request actions
  setCurrentRequest: (request: HttpRequest) => void;
  updateRequest: (updates: Partial<HttpRequest>) => void;
  resetRequest: () => void;

  // URL and params
  setUrl: (url: string) => void;
  setMethod: (method: HttpRequest['method']) => void;

  // Params
  addParam: () => void;
  updateParam: (id: string, updates: Partial<KeyValue>) => void;
  removeParam: (id: string) => void;

  // Headers
  addHeader: () => void;
  updateHeader: (id: string, updates: Partial<KeyValue>) => void;
  removeHeader: (id: string) => void;

  // Body
  setBodyType: (type: HttpRequest['body']['type']) => void;
  setBodyContent: (content: string) => void;

  // Auth
  setAuth: (auth: HttpRequest['auth']) => void;

  // Response
  setResponse: (response: HttpResponse | null) => void;

  // Loading
  setLoading: (loading: boolean) => void;

  // Error
  setError: (error: string | null) => void;

  // Environments
  setEnvironments: (environments: Environment[]) => void;
  setActiveEnvironments: (names: string[]) => void;

  // History
  setHistory: (history: HistoryItem[]) => void;
  addToHistory: (item: HistoryItem) => void;
  clearHistory: () => void;

  // Collections
  setCollections: (collections: CollectionItem[]) => void;
}

type Store = AppState & StoreActions;

export const useStore = create<Store>(set => ({
  // Initial state
  currentRequest: createDefaultRequest(),
  currentResponse: null,
  isLoading: false,
  environments: [],
  activeEnvironments: [],
  history: [],
  collections: [],
  error: null,

  // Request actions
  setCurrentRequest: request => set({ currentRequest: request }),

  updateRequest: updates =>
    set(state => ({
      currentRequest: { ...state.currentRequest, ...updates },
    })),

  resetRequest: () => set({ currentRequest: createDefaultRequest(), currentResponse: null }),

  setUrl: url =>
    set(state => ({
      currentRequest: { ...state.currentRequest, url },
    })),

  setMethod: method =>
    set(state => ({
      currentRequest: { ...state.currentRequest, method },
    })),

  // Params
  addParam: () =>
    set(state => ({
      currentRequest: {
        ...state.currentRequest,
        params: [...state.currentRequest.params, createKeyValue()],
      },
    })),

  updateParam: (id, updates) =>
    set(state => ({
      currentRequest: {
        ...state.currentRequest,
        params: state.currentRequest.params.map(p => (p.id === id ? { ...p, ...updates } : p)),
      },
    })),

  removeParam: id =>
    set(state => ({
      currentRequest: {
        ...state.currentRequest,
        params: state.currentRequest.params.filter(p => p.id !== id),
      },
    })),

  // Headers
  addHeader: () =>
    set(state => ({
      currentRequest: {
        ...state.currentRequest,
        headers: [...state.currentRequest.headers, createKeyValue()],
      },
    })),

  updateHeader: (id, updates) =>
    set(state => ({
      currentRequest: {
        ...state.currentRequest,
        headers: state.currentRequest.headers.map(h => (h.id === id ? { ...h, ...updates } : h)),
      },
    })),

  removeHeader: id =>
    set(state => ({
      currentRequest: {
        ...state.currentRequest,
        headers: state.currentRequest.headers.filter(h => h.id !== id),
      },
    })),

  // Body
  setBodyType: type =>
    set(state => ({
      currentRequest: {
        ...state.currentRequest,
        body: { ...state.currentRequest.body, type },
      },
    })),

  setBodyContent: content =>
    set(state => ({
      currentRequest: {
        ...state.currentRequest,
        body: { ...state.currentRequest.body, content },
      },
    })),

  // Auth
  setAuth: auth =>
    set(state => ({
      currentRequest: { ...state.currentRequest, auth },
    })),

  // Response
  setResponse: response => set({ currentResponse: response }),

  // Loading
  setLoading: isLoading => set({ isLoading }),

  // Error
  setError: error => set({ error }),

  // Environments
  setEnvironments: environments => set({ environments }),
  setActiveEnvironments: activeEnvironments => set({ activeEnvironments }),

  // History
  setHistory: history => set({ history }),
  addToHistory: item =>
    set(state => ({
      history: [item, ...state.history].slice(0, 50), // Keep last 50 items
    })),
  clearHistory: () => set({ history: [] }),

  // Collections
  setCollections: collections => set({ collections }),
}));
