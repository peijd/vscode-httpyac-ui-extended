// HTTP Methods
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

// Key-Value pair for headers, params, etc.
export interface KeyValue {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

// Authentication types
export type AuthType = 'none' | 'basic' | 'bearer' | 'oauth2';

export interface AuthConfig {
  type: AuthType;
  basic?: {
    username: string;
    password: string;
  };
  bearer?: {
    token: string;
  };
  oauth2?: {
    grantType: 'client_credentials' | 'authorization_code' | 'password';
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    scope?: string;
  };
}

// Request body types
export type BodyType = 'none' | 'json' | 'form' | 'formdata' | 'raw' | 'binary';

export interface RequestBody {
  type: BodyType;
  content: string;
  formData?: KeyValue[];
  binaryPath?: string;
}

// Request source reference (from .http)
export interface RequestSource {
  filePath?: string;
  regionSymbolName?: string;
  regionStartLine?: number;
  regionEndLine?: number;
}

// Complete HTTP Request
export interface HttpRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  meta?: KeyValue[];
  auth: AuthConfig;
  body: RequestBody;
  preRequestScript?: string;
  testScript?: string;
  source?: RequestSource;
}

// HTTP Response
export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  contentType: string;
  size: number;
  time: number;
  testResults?: TestResult[];
}

// Test result
export interface TestResult {
  message: string;
  passed: boolean;
  error?: string;
}

// History item
export interface HistoryItem {
  id: string;
  request: HttpRequest;
  response?: HttpResponse;
  timestamp: number;
}

// Collection structure
export interface CollectionItem {
  id: string;
  name: string;
  type: 'folder' | 'request';
  children?: CollectionItem[];
  request?: HttpRequest;
  httpFilePath?: string;
}

// Environment
export interface Environment {
  name: string;
  variables: Record<string, string>;
  isActive: boolean;
}

// App State
export interface AppState {
  currentRequest: HttpRequest;
  currentResponse: HttpResponse | null;
  isLoading: boolean;
  environments: Environment[];
  activeEnvironments: string[];
  history: HistoryItem[];
  collections: CollectionItem[];
  error: string | null;
}

// Message types for VSCode communication
export type MessageType =
  | 'sendRequest'
  | 'requestResponse'
  | 'requestError'
  | 'getEnvironments'
  | 'setEnvironments'
  | 'environmentsUpdated'
  | 'getHistory'
  | 'historyUpdated'
  | 'getCollections'
  | 'collectionsUpdated'
  | 'createCollection'
  | 'saveToHttpFile'
  | 'saveRequest'
  | 'openInEditor'
  | 'openHttpFile'
  | 'setRequest'
  | 'showNotification'
  | 'ready';

export interface Message<T = unknown> {
  type: MessageType;
  payload?: T;
  requestId?: string;
}

// VSCode API type
declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

export interface VsCodeApi {
  postMessage(message: Message): void;
  getState(): unknown;
  setState(state: unknown): void;
}
