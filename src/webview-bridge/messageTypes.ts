// Message types shared between extension and webview
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
  | 'appendToHttpFile'
  | 'saveRequest'
  | 'getRequestText'
  | 'requestText'
  | 'openInEditor'
  | 'openHttpFile'
  | 'openSourceLocation'
  | 'attachToHttpFile'
  | 'runCollection'
  | 'getRunnerResults'
  | 'runnerResultsUpdated'
  | 'setRequest'
  | 'showNotification'
  | 'ready';

export interface Message<T = unknown> {
  type: MessageType;
  payload?: T;
  requestId?: string;
}

// HTTP Method types
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
export type BodyType = 'none' | 'json' | 'form' | 'formdata' | 'raw' | 'binary' | 'graphql' | 'ndjson' | 'xml';

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
  sourceHash?: string;
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

export interface BatchRunRequest {
  label?: string;
  filePaths: string[];
}

export interface BatchRunEntry {
  filePath: string;
  name: string;
  method?: string;
  url?: string;
  status?: number;
  statusText?: string;
  durationMs?: number;
  testTotal: number;
  testFailed: number;
  error?: string;
  request?: HttpRequest;
  response?: HttpResponse;
}

export interface BatchRunFileResult {
  filePath: string;
  durationMs: number;
  entries: BatchRunEntry[];
  error?: string;
}

export interface BatchRunSummary {
  label: string;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  totalRequests: number;
  failedRequests: number;
  totalTests: number;
  failedTests: number;
  files: BatchRunFileResult[];
}
