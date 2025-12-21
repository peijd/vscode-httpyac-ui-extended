import * as vscode from 'vscode';
import * as httpyac from 'httpyac';
import { DocumentStore } from '../documentStore';
import { ResponseStore } from '../responseStore';
import { getEnvironmentConfig } from '../config';
import { StoreController } from '../provider/storeController';
import type { Message, HttpRequest, HttpResponse, CollectionItem, HistoryItem, KeyValue, TestResult } from './messageTypes';
import { convertHttpRegionToRequest, convertRequestToHttpContent, getHttpRegionDisplayName } from './httpFileConverter';
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
      case 'createCollection':
        await this.handleCreateCollection();
        break;
      case 'saveToHttpFile':
        await this.handleSaveToHttpFile(message.payload as HttpRequest);
        break;
      case 'saveRequest':
        await this.handleSaveRequest(message.payload as HttpRequest);
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
      let parseUri: vscode.Uri | undefined;
      if (request.source?.filePath) {
        parseUri = vscode.Uri.file(request.source.filePath);
      } else {
        const current = await this.documentStore.getCurrentHttpFile();
        if (current) {
          parseUri = toUri(current.fileName);
        }
      }
      const httpFile = await this.documentStore.parse(parseUri, httpContent);

      if (!httpFile || httpFile.httpRegions.length === 0) {
        throw new Error('Failed to parse request');
      }

      const httpRegion = httpFile.httpRegions.find(region => !region.isGlobal() && region.request);
      if (!httpRegion) {
        throw new Error('Failed to parse request');
      }
      let responseForWebview: httpyac.HttpResponse | undefined;
      let activeEnvironment: string[] | undefined = this.documentStore.activeEnvironment;
      if (!activeEnvironment && request.source?.filePath) {
        try {
          const sourceHttpFile = await this.documentStore.getWithUri(vscode.Uri.file(request.source.filePath));
          activeEnvironment = this.documentStore.getActiveEnvironment(sourceHttpFile);
        } catch {
          // fallback to global active environment
        }
      }

      const context: httpyac.HttpRegionSendContext = {
        httpFile,
        httpRegion,
        activeEnvironment,
      };
      context.logResponse = async (response, region) => {
        if (response) {
          responseForWebview = response;
          const cloned = httpyac.utils.cloneResponse(response);
          await this.responseStore.add(cloned, region, false);
        }
      };

      await this.documentStore.send(context);

      const response = responseForWebview || httpRegion?.response;
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

  private async handleSaveRequest(request: HttpRequest): Promise<void> {
    if (!request?.source?.filePath) {
      await this.handleSaveToHttpFile(request);
      return;
    }

    try {
      const uri = vscode.Uri.file(request.source.filePath);
      const fileBuffer = await vscode.workspace.fs.readFile(uri);
      const fileText = Buffer.from(fileBuffer).toString('utf-8');
      const httpFile = await this.documentStore.getWithUri(uri);

      const targetRegion = this.findRegionForRequest(httpFile, request);
      if (!targetRegion) {
        vscode.window.showErrorMessage('未找到对应的请求区域，请确认 .http 文件未发生结构变化。');
        return;
      }

      const updatedRegion = this.buildUpdatedRegionContent(targetRegion, request);
      const updatedFile = this.replaceRegionInFile(fileText, targetRegion, updatedRegion);

      await vscode.workspace.fs.writeFile(uri, Buffer.from(updatedFile, 'utf-8'));
      vscode.window.showInformationMessage('请求已保存到 .http 文件');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage('保存请求失败: ' + message);
    }
  }

  private async handleCreateCollection(): Promise<void> {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
      const defaultUri = workspaceFolder
        ? vscode.Uri.joinPath(workspaceFolder, 'new-collection.http')
        : vscode.Uri.file('new-collection.http');
      const uri = await vscode.window.showSaveDialog({
        defaultUri,
        saveLabel: 'Create Collection',
        filters: {
          'HTTP Files': ['http', 'rest'],
        },
      });

      if (!uri) {
        return;
      }

      const template = ['### New Request', 'GET https://example.com', ''].join('\n');
      await vscode.workspace.fs.writeFile(uri, Buffer.from(template, 'utf-8'));
      await vscode.window.showTextDocument(uri, { preview: false });
      vscode.window.showInformationMessage('Collection created: ' + uri.fsPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage('Failed to create collection: ' + message);
    }
  }

  private async handleOpenHttpFile(filePath: string): Promise<void> {
    try {
      const uri = vscode.Uri.file(filePath);
      const httpFile = await this.documentStore.getWithUri(uri);
      const requests = httpFile.httpRegions
        .filter(region => !region.isGlobal() && region.request)
        .map(region => {
          const request = convertHttpRegionToRequest(region);
          if (!request) {
            return undefined;
          }
          return {
            region,
            request: {
              ...request,
              source: {
                filePath: uri.fsPath,
                regionSymbolName: region.symbol.name,
                regionStartLine: region.symbol.startLine,
                regionEndLine: region.symbol.endLine,
              },
            },
          };
        })
        .filter((obj): obj is { region: httpyac.HttpRegion; request: HttpRequest } => !!obj?.request);

      if (requests.length === 1) {
        await this.handleOpenInEditor(requests[0].request as HttpRequest);
      } else if (requests.length > 1) {
        const picked = await vscode.window.showQuickPick(
          requests.map((obj, index) => ({
            label: getHttpRegionDisplayName(obj.region) || `Request ${index + 1}`,
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
    const httpFile = await this.getHttpFileForEnvironment();
    if (httpFile) {
      const config = await getEnvironmentConfig(httpFile.fileName);
      const envNames = await httpyac.getEnvironments({
        httpFile,
        config,
      });
      const envEntries = await Promise.all(
        envNames
          .filter(name => name && name !== '$shared')
          .map(async name => {
            const variables = await httpyac.getVariables({
              httpFile: { ...httpFile },
              activeEnvironment: [name],
              config,
            });
            return {
              name,
              variables: this.normalizeVariables(variables),
            };
          })
      );
      environments.push(...envEntries);
      const activeEnv = this.documentStore.getActiveEnvironment(httpFile);
      if (activeEnv && activeEnv.length > 0) {
        active.push(...activeEnv);
      }
    }
    if (active.length === 0 && this.documentStore.activeEnvironment) {
      active.push(...this.documentStore.activeEnvironment);
    }
    return { environments, active };
  }

  private async getHttpFileForEnvironment(): Promise<httpyac.HttpFile | undefined> {
    const current = await this.documentStore.getCurrentHttpFile();
    if (current) {
      return current;
    }
    const existing = this.documentStore.getAll();
    if (existing.length > 0) {
      return existing[0];
    }
    const workspaceFiles = await this.getWorkspaceHttpFiles();
    return workspaceFiles[0];
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
    const httpFiles = await this.getWorkspaceHttpFiles();
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

  private async getWorkspaceHttpFiles(): Promise<httpyac.HttpFile[]> {
    const httpFilesById = new Map<string, httpyac.HttpFile>();
    const existing = this.documentStore.getAll();
    for (const httpFile of existing) {
      const key = httpyac.io.fileProvider.toString(httpFile.fileName);
      httpFilesById.set(key, httpFile);
    }

    if (vscode.workspace.workspaceFolders?.length) {
      const extensions = ['http', 'rest'];
      const files = await vscode.workspace.findFiles(`**/*.{${extensions.join(',')}}`);
      const loadedFiles = await Promise.all(
        files.map(async uri => {
          try {
            return await this.documentStore.getWithUri(uri);
          } catch (error) {
            console.error('Failed to load http file:', uri.fsPath, error);
            return undefined;
          }
        })
      );
      for (const httpFile of loadedFiles) {
        if (!httpFile) {
          continue;
        }
        const key = httpyac.io.fileProvider.toString(httpFile.fileName);
        httpFilesById.set(key, httpFile);
      }
    }

    return Array.from(httpFilesById.values());
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
    const displayName = getHttpRegionDisplayName(region);
    return {
      id,
      name: displayName || request.name || region.symbol.name || request.url,
      type: 'request',
      request: {
        ...request,
        name: displayName || request.name,
        source: {
          filePath: uri.fsPath,
          regionSymbolName: region.symbol.name,
          regionStartLine: region.symbol.startLine,
          regionEndLine: region.symbol.endLine,
        },
      },
      httpFilePath: uri.fsPath,
    };
  }

  private findRegionForRequest(httpFile: httpyac.HttpFile, request: HttpRequest): httpyac.HttpRegion | undefined {
    const candidates = httpFile.httpRegions.filter(region => !region.isGlobal() && region.request);
    const source = request.source;

    if (source?.regionSymbolName) {
      const bySymbol = candidates.find(
        region =>
          region.symbol.name === source.regionSymbolName &&
          (source.regionStartLine === undefined || region.symbol.startLine === source.regionStartLine)
      );
      if (bySymbol) {
        return bySymbol;
      }
    }

    if (source?.regionStartLine !== undefined) {
      const byLine = candidates.find(region => region.symbol.startLine === source.regionStartLine);
      if (byLine) {
        return byLine;
      }
    }

    const byName = candidates.find(region => getHttpRegionDisplayName(region) === request.name);
    if (byName) {
      return byName;
    }

    return undefined;
  }

  private buildUpdatedRegionContent(region: httpyac.HttpRegion, request: HttpRequest): string {
    const originalSource = region.symbol.source || '';
    const lines = originalSource.split(/\r?\n/u);
    const requestLineIndex = lines.findIndex(line => /^\s*(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)\s+/iu.test(line));

    if (requestLineIndex === -1) {
      return convertRequestToHttpContent(request);
    }

    const prefixLines = lines.slice(0, requestLineIndex);
    const cleanedPrefix: string[] = [];
    let inScript = false;
    for (const line of prefixLines) {
      if (line.trim() === '> {%') {
        inScript = true;
        continue;
      }
      if (inScript) {
        if (line.trim() === '%}') {
          inScript = false;
        }
        continue;
      }
      cleanedPrefix.push(line);
    }

    const metaLineIndices = cleanedPrefix
      .map((line, index) => (/\s*#?\s*@/u.test(line) ? index : -1))
      .filter(index => index >= 0);

    const filteredPrefix = cleanedPrefix.filter(line => !/\s*#?\s*@/u.test(line));
    const insertIndex = metaLineIndices.length > 0 ? Math.min(...metaLineIndices) : 0;

    const metaItems = request.meta || [];
    const metaLines = metaItems
      .filter(item => item.enabled && item.key)
      .map(item => {
        const key = item.key.startsWith('@') ? item.key.slice(1) : item.key;
        const value = item.value?.trim();
        return value ? `# @${key} ${value}` : `# @${key}`;
      });

    if (request.auth.type === 'oauth2' && request.auth.oauth2) {
      const hasMeta = (key: string) =>
        metaItems.some(item => item.enabled && item.key.replace(/^@/u, '').toLowerCase() === key.toLowerCase());
      if (!hasMeta('oauth2')) {
        metaLines.push(`# @oauth2 ${request.auth.oauth2.grantType}`);
      }
      if (!hasMeta('tokenUrl')) {
        metaLines.push(`# @tokenUrl ${request.auth.oauth2.tokenUrl}`);
      }
      if (!hasMeta('clientId')) {
        metaLines.push(`# @clientId ${request.auth.oauth2.clientId}`);
      }
      if (request.auth.oauth2.scope && !hasMeta('scope')) {
        metaLines.push(`# @scope ${request.auth.oauth2.scope}`);
      }
    }

    const prefixWithMeta = [
      ...filteredPrefix.slice(0, insertIndex),
      ...metaLines,
      ...filteredPrefix.slice(insertIndex),
    ];

    const preScriptLines = request.preRequestScript
      ? ['> {%', ...request.preRequestScript.split(/\r?\n/u), '%}']
      : [];

    const testScriptLines = request.testScript
      ? ['> {%', ...request.testScript.split(/\r?\n/u), '%}']
      : [];

    const requestLines = httpyac.utils.toHttpStringRequest(
      {
        method: request.method,
        url: (() => {
          let url = request.url || '';
          const params = request.params.filter(p => p.enabled && p.key);
          if (params.length > 0) {
            const query = params
              .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
              .join('&');
            url += (url.includes('?') ? '&' : '?') + query;
          }
          return url;
        })(),
        headers: (() => {
          const headers: Record<string, unknown> = {};
          const addHeader = (key: string, value: string) => {
            if (headers[key]) {
              const current = headers[key];
              headers[key] = Array.isArray(current) ? [...current, value] : [current as string, value];
            } else {
              headers[key] = value;
            }
          };
          for (const header of request.headers.filter(h => h.enabled && h.key)) {
            addHeader(header.key, header.value);
          }
          if (request.auth.type === 'basic' && request.auth.basic) {
            const credentials = Buffer.from(
              `${request.auth.basic.username}:${request.auth.basic.password}`
            ).toString('base64');
            addHeader('Authorization', `Basic ${credentials}`);
          } else if (request.auth.type === 'bearer' && request.auth.bearer) {
            addHeader('Authorization', `Bearer ${request.auth.bearer.token}`);
          }
          return headers;
        })(),
        body: (() => {
          if (request.body.type === 'none') return undefined;
          if ((request.body.type === 'form' || request.body.type === 'formdata') && request.body.formData) {
            return request.body.formData
              .filter(f => f.enabled && f.key)
              .map(f => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`)
              .join('&');
          }
          return request.body.content || '';
        })(),
      },
      { body: request.body.type !== 'none' }
    );

    return [
      ...prefixWithMeta,
      ...preScriptLines,
      ...requestLines,
      ...testScriptLines,
    ].join('\n');
  }

  private replaceRegionInFile(fileText: string, region: httpyac.HttpRegion, updatedRegion: string): string {
    const eol = fileText.includes('\r\n') ? '\r\n' : '\n';
    const lines = fileText.split(/\r?\n/u);
    const start = region.symbol.startLine;
    const end = region.symbol.endLine;
    const updatedLines = updatedRegion.split(/\r?\n/u);

    const before = lines.slice(0, start);
    const after = lines.slice(end + 1);
    return [...before, ...updatedLines, ...after].join(eol);
  }
}
