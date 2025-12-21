import * as vscode from 'vscode';
import { DisposeProvider } from '../utils';
import { WebviewMessageHandler, Message } from '../webview-bridge';

export class WebviewSidebarProvider extends DisposeProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'httpyacRequestBuilder';

  private view?: vscode.WebviewView;
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly messageHandler: WebviewMessageHandler
  ) {
    super();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    void _context;
    void _token;
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview')],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview, 'sidebar');

    // Handle messages from the webview
    this.subscriptions.push(
      webviewView.webview.onDidReceiveMessage(async (message: Message) => {
        await this.messageHandler.handleMessage(message, webviewView.webview);
      })
    );
    this.subscriptions.push(this.messageHandler.attach(webviewView.webview));

    // Handle visibility changes
    this.subscriptions.push(
      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) {
          // Refresh data when view becomes visible
          webviewView.webview.postMessage({ type: 'ready' });
        }
      })
    );
  }

  private getHtmlForWebview(webview: vscode.Webview, entryPoint: 'sidebar' | 'editor'): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'assets', `${entryPoint}.js`)
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'assets', 'index.css')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <link href="${styleUri}" rel="stylesheet">
  <title>httpYac Request Builder</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  public postMessage(message: Message): void {
    if (this.view) {
      this.view.webview.postMessage(message);
    }
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
