import * as vscode from 'vscode';
import * as httpyac from 'httpyac';
import { DocumentStore } from '../documentStore';
import { ResponseStore } from '../responseStore';
import { getEnvironmentConfig } from '../config';
import type { Message, HttpRequest, HttpResponse, CollectionItem, HistoryItem } from './messageTypes';
import { convertRequestToHttpContent, parseHttpFile } from './httpFileConverter';

export class WebviewMessageHandler {
  constructor(
    private readonly documentStore: DocumentStore,
    _responseStore: ResponseStore
  ) {}

  async handleMessage(message: Message, webview: vscode.Webview): Promise<void> {
    switch (message.type) {
      case 'sendRequest':
        await this.handleSendRequest(message.payload as HttpRequest, webview, message.requestId);
        break;

      case 'getEnvironments':
        await this.handleGetEnvironments(webview);
        break;

      case 'setEnvironments':
        await this.handleSetEnvironments(message.payload as string[]);
        break;

      case 'getHistory':
        await this.handleGetHistory(webview);
        break;

      case 'getCollections':
        await this.handleGetCollections(webview);
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
        // Webview is ready, send initial data
        await this.handleGetEnvironments(webview);
        await this.handleGetHistory(webview);
        await this.handleGetCollections(webview);
        break;

      default:
        console.log('Unhandled message type:', message.type);
    }
  }

  private async handleSendRequest(request: HttpRequest, webview: vscode.Webview, requestId?: string): Promise<void> {
    try {
      const startTime = Date.now();

      // Convert webview request to httpyac format
      const httpContent = convertRequestToHttpContent(request);

      // Create a temporary httpFile from the content using DocumentStore
      const httpFile = await this.documentStore.parse(undefined, httpContent);

      if (!httpFile || httpFile.httpRegions.length === 0) {
        throw new Error('Failed to parse request');
      }

      const httpRegion = httpFile.httpRegions[0];

      // Send the request using DocumentStore.send
      const context: httpyac.HttpRegionSendContext = {
        httpFile,
        httpRegion,
      };

      await this.documentStore.send(context);

      // Get response
      const response = httpRegion.response;
      if (response) {
        const httpResponse: HttpResponse = {
          status: response.statusCode || 0,
          statusText: response.statusMessage || '',
          headers: this.normalizeHeaders(response.headers),
          body: response.body ? this.getBodyAsString(response.body, response.rawBody) : '',
          contentType: response.contentType?.contentType || '',
          size: response.rawBody?.length || 0,
          time: Date.now() - startTime,
          testResults: httpRegion.testResults?.map((t: httpyac.TestResult) => ({
            message: t.message || '',
            passed: t.status === httpyac.TestResultStatus.SUCCESS,
            error: t.error?.message,
          })),
        };

        webview.postMessage({
          type: 'requestResponse',
          payload: httpResponse,
          requestId,
        });
      } else {
        throw new Error('No response received');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      webview.postMessage({
        type: 'requestError',
        payload: errorMessage,
        requestId,
      });
    }
  }

  private normalizeHeaders(headers: httpyac.HttpResponse['headers']): Record<string, string> {
    const result: Record<string, string> = {};
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        result[key] = Array.isArray(value) ? value.join(', ') : String(value);
      }
    }
    return result;
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
    return String(body);
  }

  private async handleGetEnvironments(webview: vscode.Webview): Promise<void> {
    try {
      const environments: Array<{ name: string; variables: Record<string, string> }> = [];
      const activeEnvs: string[] = [];

      // Get environments from active document or workspace
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        const httpFile = await this.documentStore.getHttpFile(activeEditor.document);
        if (httpFile) {
          const config = await getEnvironmentConfig(httpFile.fileName);
          if (config.environments) {
            for (const [name, vars] of Object.entries(config.environments)) {
              if (name !== '$shared') {
                environments.push({
                  name,
                  variables: vars as Record<string, string>,
                });
              }
            }
          }
          // Get active environments from documentStore
          const active = this.documentStore.getActiveEnvironment(httpFile);
          if (active) {
            activeEnvs.push(...active);
          }
        }
      }

      webview.postMessage({
        type: 'environmentsUpdated',
        payload: { environments, active: activeEnvs },
      });
    } catch (error) {
      console.error('Error getting environments:', error);
    }
  }

  private async handleSetEnvironments(_envNames: string[]): Promise<void> {
    try {
      await vscode.commands.executeCommand('httpyac.toggle-env');
    } catch (error) {
      console.error('Error setting environments:', error);
    }
  }

  private async handleGetHistory(webview: vscode.Webview): Promise<void> {
    try {
      // Get history from response store
      const historyItems: HistoryItem[] = [];

      // The response store has response items, convert them to history format
      // For now, return an empty array as we'll build this incrementally
      webview.postMessage({
        type: 'historyUpdated',
        payload: historyItems,
      });
    } catch (error) {
      console.error('Error getting history:', error);
    }
  }

  private async handleGetCollections(webview: vscode.Webview): Promise<void> {
    try {
      console.log('[httpyac] handleGetCollections called');
      const collections: CollectionItem[] = [];

      // Find all .http files in workspace
      const httpFiles = await vscode.workspace.findFiles('**/*.{http,rest}', '**/node_modules/**');
      console.log('[httpyac] Found .http files:', httpFiles.length);

      for (const uri of httpFiles) {
        const relativePath = vscode.workspace.asRelativePath(uri);
        const parts = relativePath.split('/');
        const fileName = parts.pop() || '';

        // Create folder structure
        let current = collections;
        for (let i = 0; i < parts.length; i++) {
          const folderName = parts[i];
          let folder = current.find(c => c.type === 'folder' && c.name === folderName);
          if (!folder) {
            folder = {
              id: parts.slice(0, i + 1).join('/'),
              name: folderName,
              type: 'folder',
              children: [],
            };
            current.push(folder);
          }
          current = folder.children || [];
        }

        // Parse the http file to get requests
        try {
          const content = await vscode.workspace.fs.readFile(uri);
          const requests = await parseHttpFile(content.toString(), uri.fsPath);

          if (requests.length > 0) {
            // If file has multiple requests, create a folder for the file
            if (requests.length > 1) {
              const fileFolder: CollectionItem = {
                id: uri.toString(),
                name: fileName,
                type: 'folder',
                children: requests.map((req, idx) => ({
                  id: `${uri.toString()}#${idx}`,
                  name: req.name || `${req.method} ${req.url}`,
                  type: 'request' as const,
                  request: req,
                  httpFilePath: uri.fsPath,
                })),
                httpFilePath: uri.fsPath,
              };
              current.push(fileFolder);
            } else {
              // Single request - show directly
              const req = requests[0];
              current.push({
                id: uri.toString(),
                name: req.name || fileName,
                type: 'request',
                request: req,
                httpFilePath: uri.fsPath,
              });
            }
          } else {
            // No requests parsed, show as empty file
            current.push({
              id: uri.toString(),
              name: fileName,
              type: 'request',
              httpFilePath: uri.fsPath,
            });
          }
        } catch (parseError) {
          console.error('Error parsing HTTP file:', uri.fsPath, parseError);
          // Add file without parsed requests
          current.push({
            id: uri.toString(),
            name: fileName,
            type: 'request',
            httpFilePath: uri.fsPath,
          });
        }
      }

      console.log('[httpyac] Sending collections:', JSON.stringify(collections, null, 2));
      webview.postMessage({
        type: 'collectionsUpdated',
        payload: collections,
      });
    } catch (error) {
      console.error('Error getting collections:', error);
    }
  }

  private async handleSaveToHttpFile(request: HttpRequest): Promise<void> {
    try {
      const content = convertRequestToHttpContent(request);

      // Ask user where to save
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
      const content = await vscode.workspace.fs.readFile(uri);
      const requests = await parseHttpFile(content.toString(), filePath);

      if (requests.length > 0) {
        // If there's only one request, open it directly
        // If multiple, let user choose
        if (requests.length === 1) {
          await this.handleOpenInEditor(requests[0]);
        } else {
          const items = requests.map((r, i) => ({
            label: r.name || `Request ${i + 1}`,
            description: `${r.method} ${r.url}`,
            request: r,
          }));

          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a request to edit',
          });

          if (selected) {
            await this.handleOpenInEditor(selected.request);
          }
        }
      }
    } catch (error) {
      console.error('Error opening HTTP file:', error);
    }
  }

  private async handleOpenInEditor(request: HttpRequest): Promise<void> {
    try {
      // Open the editor webview panel with the request
      await vscode.commands.executeCommand('httpyac.openRequestEditor', request);
    } catch (error) {
      console.error('Error opening in editor:', error);
    }
  }
}
