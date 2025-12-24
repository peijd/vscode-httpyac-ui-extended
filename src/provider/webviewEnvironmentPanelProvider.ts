import * as vscode from 'vscode';
import { DisposeProvider } from '../utils';
import { WebviewMessageHandler, Message } from '../webview-bridge';
import { commands } from '../config';

export class WebviewEnvironmentPanelProvider extends DisposeProvider {
  private static currentPanel: WebviewEnvironmentPanelProvider | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly messageHandler: WebviewMessageHandler;

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    messageHandler: WebviewMessageHandler
  ) {
    super();
    this.panel = panel;
    this.messageHandler = messageHandler;

    this.panel.webview.html = this.getHtmlForWebview();

    this.subscriptions.push(
      this.panel.webview.onDidReceiveMessage(async (message: Message) => {
        await this.messageHandler.handleMessage(message, this.panel.webview);
      })
    );
    this.subscriptions.push(this.messageHandler.attach(this.panel.webview));

    this.panel.onDidDispose(() => this.dispose(), null, this.subscriptions);
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    messageHandler: WebviewMessageHandler
  ): WebviewEnvironmentPanelProvider {
    const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

    if (WebviewEnvironmentPanelProvider.currentPanel) {
      WebviewEnvironmentPanelProvider.currentPanel.panel.reveal(column);
      return WebviewEnvironmentPanelProvider.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'httpyacEnvironmentSnapshot',
      'httpYac Environment Snapshot',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist', 'webview')],
      }
    );

    WebviewEnvironmentPanelProvider.currentPanel = new WebviewEnvironmentPanelProvider(
      panel,
      extensionUri,
      messageHandler
    );
    return WebviewEnvironmentPanelProvider.currentPanel;
  }

  public static registerCommands(
    context: vscode.ExtensionContext,
    messageHandler: WebviewMessageHandler
  ): vscode.Disposable[] {
    return [
      vscode.commands.registerCommand(commands.openEnvironmentSnapshot, () => {
        WebviewEnvironmentPanelProvider.createOrShow(context.extensionUri, messageHandler);
      }),
    ];
  }

  private getHtmlForWebview(): string {
    const webview = this.panel.webview;
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'assets', 'env.js')
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
  <title>httpYac Environment Snapshot</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  public dispose(): void {
    WebviewEnvironmentPanelProvider.currentPanel = undefined;
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
