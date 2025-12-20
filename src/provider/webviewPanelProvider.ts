import * as vscode from 'vscode';
import { DisposeProvider } from '../utils';
import { DocumentStore } from '../documentStore';
import { ResponseStore } from '../responseStore';
import { WebviewMessageHandler, Message, HttpRequest } from '../webview-bridge';
import { commands } from '../config';

export class WebviewPanelProvider extends DisposeProvider {
  private static currentPanel: WebviewPanelProvider | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly messageHandler: WebviewMessageHandler;
  private initialRequest?: HttpRequest;
  private pendingRequest?: HttpRequest;
  private isReady = false;

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    documentStore: DocumentStore,
    responseStore: ResponseStore
  ) {
    super();
    this.panel = panel;
    this.messageHandler = new WebviewMessageHandler(documentStore, responseStore);

    // Set the webview's html content
    this.panel.webview.html = this.getHtmlForWebview();

    // Handle messages from the webview
    this.subscriptions.push(
      this.panel.webview.onDidReceiveMessage(async (message: Message) => {
        // When webview signals it's ready, send any pending request
        if (message.type === 'ready') {
          this.isReady = true;
          if (this.pendingRequest) {
            this.setRequest(this.pendingRequest);
            this.pendingRequest = undefined;
          }
        }
        await this.messageHandler.handleMessage(message, this.panel.webview);
      })
    );

    // Handle panel disposal
    this.panel.onDidDispose(() => this.dispose(), null, this.subscriptions);
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    documentStore: DocumentStore,
    responseStore: ResponseStore,
    request?: HttpRequest
  ): WebviewPanelProvider {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (WebviewPanelProvider.currentPanel) {
      WebviewPanelProvider.currentPanel.panel.reveal(column);
      if (request) {
        WebviewPanelProvider.currentPanel.setRequest(request);
      }
      return WebviewPanelProvider.currentPanel;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'httpyacRequestEditor',
      'httpYac Request Editor',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist', 'webview'),
        ],
      }
    );

    WebviewPanelProvider.currentPanel = new WebviewPanelProvider(
      panel,
      extensionUri,
      documentStore,
      responseStore
    );

    if (request) {
      WebviewPanelProvider.currentPanel.initialRequest = request;
    }

    return WebviewPanelProvider.currentPanel;
  }

  public static registerCommands(
    context: vscode.ExtensionContext,
    documentStore: DocumentStore,
    responseStore: ResponseStore
  ): vscode.Disposable[] {
    return [
      vscode.commands.registerCommand(commands.openRequestEditor, (request?: HttpRequest) => {
        WebviewPanelProvider.createOrShow(
          context.extensionUri,
          documentStore,
          responseStore,
          request
        );
      }),
    ];
  }

  public setRequest(request: HttpRequest): void {
    if (this.isReady) {
      this.panel.webview.postMessage({
        type: 'setRequest',
        payload: request,
      });
    } else {
      // Store request to send when webview is ready
      this.pendingRequest = request;
    }
  }

  private getHtmlForWebview(): string {
    const webview = this.panel.webview;
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'assets', 'editor.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'assets', 'index.css')
    );

    const nonce = getNonce();

    // If we have an initial request, embed it in the HTML
    const initialState = this.initialRequest
      ? `<script nonce="${nonce}">window.__INITIAL_REQUEST__ = ${JSON.stringify(this.initialRequest)};</script>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <link href="${styleUri}" rel="stylesheet">
  <title>httpYac Request Editor</title>
</head>
<body>
  <div id="root"></div>
  ${initialState}
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  public dispose(): void {
    WebviewPanelProvider.currentPanel = undefined;
    this.panel.dispose();
    super.dispose();
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

