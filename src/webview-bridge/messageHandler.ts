import * as vscode from 'vscode';
import * as httpyac from 'httpyac';
import { DocumentStore } from '../documentStore';
import { ResponseStore } from '../responseStore';
import { getEnvironmentConfig } from '../config';
import { StoreController } from '../provider/storeController';
import type { Message, HttpRequest, HttpResponse, CollectionItem, HistoryItem, KeyValue, TestResult } from './messageTypes';
import { convertHttpRegionToRequest, convertRequestToHttpContent } from './httpFileConverter';
import { toUri } from '../io';
import { ResponseItem } from '../view';

export class WebviewMessageHandler implements vscode.Disposable {
  private readonly webviews = new Set<vscode.Webview>();
  private readonly disposables: vscode.Disposable[];

  constructor(
    private readonly documentStore: DocumentStore,
    private readonly responseStore: ResponseStore,
    private readonly storeController: StoreController
  ) {
    this.disposables = [
      this.documentStore.documentStoreChanged(() => {
        void this.broadcastEnvironmentState();
      }),
      this.storeController.environmentChanged(() => {
        void this.broadcastEnvironmentState();
      }),
      this.documentStore.httpFileChanged(() => {
        void this.broadcastCollections();
      }),
      this.responseStore.historyChanged(() => {
        void this.broadcastHistory();
      }),
    ];
  }

  public attach(webview: vscode.Webview): vscode.Disposable {
    this.webviews.add(webview);
    return {
      dispose: () => {
        this.webviews.delete(webview);
      },
    };
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.webviews.clear();
  }

  async handleMessage(message: Message, webview: vscode.Webview): Promise<void> {
    switch (message.type) {
      case 'sendRequest':
        await this.handleSendRequest(message.payload as HttpRequest, webview, message.requestId);
        break;
      case 'getEnvironments':
        await this.broadcastEnvironmentState(webview);
        break;
      case 'setEnvironments':
        await this.handleSetEnvironments(message.payload as string[]);
        break;
      case 'getHistory':
        await this.broadcastHistory(webview);
        break;
      case 'getCollections':
        await this.broadcastCollections(webview);
        break;
      case 'saveToHttpFile':
        await this.handleSaveToHttpFile(message.payload as HttpRequest);
        break;
      case 'openInEditor':
        await this.handleOpenInEditor(message.payload as HttpRequest);
        break;
      case 'openHttpFile':
        await this.handleOpenHttpFile(message.payload as string);
        break;
      case 'ready':
        await Promise.all([
          this.broadcastEnvironmentState(webview),
          this.broadcastHistory(webview),
          this.broadcastCollections(webview),
        ]);
        break;
      default:
        console.log('Unhandled message type:', message.type);
    }
  }

  private async handleSendRequest(request: HttpRequest, webview: vscode.Webview, requestId?: string): Promise<void> {
    try {
      const startTime = Date.now();
      const httpContent = convertRequestToHttpContent(request);
      const httpFile = await this.documentStore.parse(undefined, httpContent);

      if (!httpFile || httpFile.httpRegions.length === 0) {
        throw new Error('Failed to parse request');
      }

      const httpRegion = httpFile.httpRegions[0];
      const context: httpyac.HttpRegionSendContext = {
        httpFile,
        httpRegion,
      };
      context.logResponse = async (response, region) => {
        if (response) {
          await this.responseStore.add(response, region);
        }
      };

      await this.documentStore.send(context);

      const response = httpRegion.response;
      if (response) {
        const httpResponse = this.toHttpResponse(response, httpRegion.testResults, startTime);
        this.postMessage(
          {
            type: 'requestResponse',
            payload: httpResponse,
            requestId,
          },
          webview
        );
      } else {
        throw new Error('No response received');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.postMessage(
        {
          type: 'requestError',
          payload: errorMessage,
          requestId,
        },
        webview
      );
    }
  }

  private async handleSetEnvironments(envNames: string[]): Promise<void> {
    try {
      const httpFile = await this.documentStore.getCurrentHttpFile();
      if (httpFile) {
        await this.storeController.selectEnvironment(envNames.length > 0 ? envNames : undefined, httpFile);
      } else {
        this.documentStore.activeEnvironment = envNames.length > 0 ? envNames : undefined;
      }
    } catch (error) {
      console.error('Error setting environments:', error);
    }
  }

  private async handleSaveToHttpFile(request: HttpRequest): Promise<void> {
    try {
      const content = convertRequestToHttpContent(request);
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('request.http'),
        filters: {
          'HTTP Files': ['http', 'rest'],
        },
      });

      if (uri) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
        await vscode.window.showTextDocument(uri);
        vscode.window.showInformationMessage('Request saved to ' + uri.fsPath);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage('Failed to save request: ' + message);
    }
  }

  private async handleOpenHttpFile(filePath: string): Promise<void> {
    try {
      const uri = vscode.Uri.file(filePath);
      const httpFile = await this.documentStore.getWithUri(uri);
      const requests = httpFile.httpRegions
        .filter(region => !region.isGlobal() && region.request)
        .map(region => ({
          region,
          request: convertHttpRegionToRequest(region),
        }))
        .filter(obj => obj.request);

      if (requests.length === 1) {
        await this.handleOpenInEditor(requests[0].request as HttpRequest);
      } else if (requests.length > 1) {
        const picked = await vscode.window.showQuickPick(
          requests.map((obj, index) => ({
            label: obj.region.symbol.name || `Request ${index + 1}`,
            description: obj.region.request?.url,
            request: obj.request as HttpRequest,
          })),
          {
            placeHolder: 'Select a request to edit',
          }
        );
        if (picked) {
          await this.handleOpenInEditor(picked.request);
        }
      } else {
        vscode.window.showInformationMessage('No requests found in file');
      }
    } catch (error) {
      console.error('Error opening HTTP file:', error);
    }
  }

  private async handleOpenInEditor(request: HttpRequest): Promise<void> {
    try {
      await vscode.commands.executeCommand('httpyac.openRequestEditor', request);
    } catch (error) {
      console.error('Error opening in editor:', error);
    }
  }

  private postMessage(message: Message, target?: vscode.Webview): void {
    if (target) {
      target.postMessage(message);
      return;
    }
    for (const webview of this.webviews) {
      webview.postMessage(message);
    }
  }

  private async broadcastEnvironmentState(target?: vscode.Webview): Promise<void> {
    const payload = await this.collectEnvironmentState();
    this.postMessage(
      {
        type: 'environmentsUpdated',
        payload,
      },
      target
    );
  }

  private async collectEnvironmentState() {
    const environments: Array<{ name: string; variables: Record<string, string> }> = [];
    const active: string[] = [];
    const httpFile = await this.documentStore.getCurrentHttpFile();
    if (httpFile) {
      const config = await getEnvironmentConfig(httpFile.fileName);
      if (config.environments) {
        for (const [name, vars] of Object.entries(config.environments)) {
          if (name !== '$shared') {
            environments.push({
              name,
              variables: this.normalizeVariables(vars),
            });
          }
        }
      }
      const activeEnv = this.documentStore.getActiveEnvironment(httpFile);
      if (activeEnv) {
        active.push(...activeEnv);
      }
    }
    return { environments, active };
  }

  private normalizeVariables(vars: httpyac.Variables | undefined): Record<string, string> {
    const result: Record<string, string> = {};
    if (!vars) {
      return result;
    }
    for (const [key, value] of Object.entries(vars)) {
      if (httpyac.utils.isString(value)) {
        result[key] = value;
      } else if (value !== undefined) {
        result[key] = httpyac.utils.stringifySafe(value, 2);
      }
    }
    return result;
  }

  private async broadcastHistory(target?: vscode.Webview): Promise<void> {
    const items = this.responseStore.responseCache
      .map(item => this.toHistoryItem(item))
      .filter((item): item is HistoryItem => !!item);

    this.postMessage(
      {
        type: 'historyUpdated',
        payload: items,
      },
      target
    );
  }

  private toHistoryItem(responseItem: ResponseItem | undefined): HistoryItem | undefined {
    if (!responseItem?.response) {
      return undefined;
    }
    const request = this.toHttpRequestFromResponse(responseItem.response, responseItem.id, responseItem.name);
    return {
      id: responseItem.id,
      request,
      response: this.toHttpResponse(responseItem.response, responseItem.testResults),
      timestamp: responseItem.created.getTime(),
    };
  }

  private toHttpRequestFromResponse(response: httpyac.HttpResponse, fallbackId: string, fallbackName?: string): HttpRequest {
    const request = response.request;
    const method = (request?.method?.toUpperCase() || 'GET') as HttpRequest['method'];
    const url = (typeof request?.url === 'string' && request?.url) || '';
    const headers: KeyValue[] = [];
    if (request?.headers) {
      for (const [key, value] of Object.entries(request.headers)) {
        headers.push({
          id: `${key}`,
          key,
          value: Array.isArray(value) ? value.join(', ') : `${value}`,
          enabled: true,
        });
      }
    }
    const params: KeyValue[] = [];
    try {
      if (url) {
        const urlObj = new URL(url);
        urlObj.searchParams.forEach((value, key) => {
          params.push({
            id: `${key}`,
            key,
            value,
            enabled: true,
          });
        });
      }
    } catch {
      // ignore malformed URLs
    }
    const bodyContent = this.getBodyAsString(request?.body);
    const bodyType = this.detectBodyType(headers, bodyContent);
    return {
      id: fallbackId,
      name: fallbackName || response.name || `${method} ${url}`,
      method,
      url: bodyType === 'form' && url ? url.split('?')[0] : url,
      params,
      headers,
      auth: { type: 'none' },
      body: {
        type: bodyType,
        content: bodyContent,
      },
    };
  }

  private detectBodyType(headers: KeyValue[], bodyContent: string): HttpRequest['body']['type'] {
    if (!bodyContent) {
      return 'none';
    }
    const contentType = headers.find(h => h.key.toLowerCase() === 'content-type')?.value || '';
    if (contentType.includes('application/json')) {
      return 'json';
    }
    if (contentType.includes('application/x-www-form-urlencoded')) {
      return 'form';
    }
    return 'raw';
  }

  private getBodyAsString(body: unknown, rawBody?: Buffer): string {
    if (typeof body === 'string') {
      return body;
    }
    if (rawBody) {
      return rawBody.toString('utf-8');
    }
    if (body && typeof body === 'object') {
      return JSON.stringify(body, null, 2);
    }
    if (body !== undefined && body !== null) {
      return String(body);
    }
    return '';
  }

  private toHttpResponse(response: httpyac.HttpResponse, testResults?: Array<httpyac.TestResult>, startTime?: number): HttpResponse {
    const durationMeta = response.meta?.duration;
    const duration = typeof durationMeta === 'number' ? durationMeta : 0;
    return {
      status: response.statusCode || 0,
      statusText: response.statusMessage || '',
      headers: this.normalizeHeaders(response.headers),
      body: response.body ? this.getBodyAsString(response.body, response.rawBody) : '',
      contentType: response.contentType?.contentType || '',
      size: response.rawBody?.length || 0,
      time: startTime ? Date.now() - startTime : duration,
      testResults: this.toTestResults(testResults),
    };
  }

  private normalizeHeaders(headers: httpyac.HttpResponse['headers'] | undefined): Record<string, string> {
    const result: Record<string, string> = {};
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        result[key] = Array.isArray(value) ? value.join(', ') : String(value);
      }
    }
    return result;
  }

  private toTestResults(testResults?: Array<httpyac.TestResult>): TestResult[] | undefined {
    if (!testResults) {
      return undefined;
    }
    return testResults.map(test => ({
      message: test.message || '',
      passed: test.status === httpyac.TestResultStatus.SUCCESS,
      error: test.error?.message,
    }));
  }

  private async broadcastCollections(target?: vscode.Webview): Promise<void> {
    const payload = await this.buildCollections();
    this.postMessage(
      {
        type: 'collectionsUpdated',
        payload,
      },
      target
    );
  }

  private async buildCollections(): Promise<CollectionItem[]> {
    const httpFiles = this.documentStore.getAll();
    const roots: CollectionItem[] = [];
    const folderMap = new Map<string, CollectionItem>();

    for (const httpFile of httpFiles) {
      const uri = toUri(httpFile.fileName);
      if (!uri) {
        continue;
      }
      const httpRegions = httpFile.httpRegions.filter(region => !region.isGlobal() && region.request);
      if (httpRegions.length === 0) {
        continue;
      }
      const relativePath = vscode.workspace.asRelativePath(uri, false);
      const parts = relativePath.split(/[/\\]/u);
      const fileName = parts.pop() || uri.toString();
      const parentChildren = this.ensureFolder(roots, folderMap, parts);

      if (httpRegions.length > 1) {
        const folderItem: CollectionItem = {
          id: uri.toString(),
          name: fileName,
          type: 'folder',
          children: httpRegions
            .map((region, index) => this.createRequestItem(region, uri, `${uri.toString()}#${index}`))
            .filter((item): item is CollectionItem => !!item),
          httpFilePath: uri.fsPath,
        };
        parentChildren.push(folderItem);
      } else {
        const requestItem = this.createRequestItem(httpRegions[0], uri, uri.toString());
        if (requestItem) {
          parentChildren.push(requestItem);
        }
      }
    }

    return roots;
  }

  private ensureFolder(
    roots: CollectionItem[],
    folderMap: Map<string, CollectionItem>,
    segments: string[]
  ): CollectionItem[] {
    if (!segments.length) {
      return roots;
    }

    let currentChildren = roots;
    let currentPath = '';
    for (const segment of segments) {
      if (!segment) {
        continue;
      }
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      let folder = folderMap.get(currentPath);
      if (!folder) {
        folder = {
          id: currentPath,
          name: segment,
          type: 'folder',
          children: [],
        };
        folderMap.set(currentPath, folder);
        currentChildren.push(folder);
      }
      currentChildren = folder.children || [];
    }
    return currentChildren;
  }

  private createRequestItem(region: httpyac.HttpRegion, uri: vscode.Uri, id: string): CollectionItem | undefined {
    const request = convertHttpRegionToRequest(region);
    if (!request) {
      return undefined;
    }
    return {
      id,
      name: request.name || region.symbol.name || request.url,
      type: 'request',
      request,
      httpFilePath: uri.fsPath,
    };
  }
}
