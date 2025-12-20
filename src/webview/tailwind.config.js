/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}', './*.html'],
  theme: {
    extend: {
      colors: {
        // VSCode theme integration
        'vscode-foreground': 'var(--vscode-foreground)',
        'vscode-background': 'var(--vscode-editor-background)',
        'vscode-input-bg': 'var(--vscode-input-background)',
        'vscode-input-fg': 'var(--vscode-input-foreground)',
        'vscode-input-border': 'var(--vscode-input-border)',
        'vscode-button-bg': 'var(--vscode-button-background)',
        'vscode-button-fg': 'var(--vscode-button-foreground)',
        'vscode-button-hover': 'var(--vscode-button-hoverBackground)',
        'vscode-list-hover': 'var(--vscode-list-hoverBackground)',
        'vscode-list-active': 'var(--vscode-list-activeSelectionBackground)',
        'vscode-border': 'var(--vscode-panel-border)',
        'vscode-badge-bg': 'var(--vscode-badge-background)',
        'vscode-badge-fg': 'var(--vscode-badge-foreground)',
        'vscode-success': 'var(--vscode-testing-iconPassed)',
        'vscode-error': 'var(--vscode-testing-iconFailed)',
        'vscode-warning': 'var(--vscode-editorWarning-foreground)',
        'vscode-link': 'var(--vscode-textLink-foreground)',
        // Method colors
        'method-get': '#61affe',
        'method-post': '#49cc90',
        'method-put': '#fca130',
        'method-delete': '#f93e3e',
        'method-patch': '#50e3c2',
        'method-options': '#0d5aa7',
        'method-head': '#9012fe',
      },
      fontFamily: {
        vscode: 'var(--vscode-font-family)',
        mono: 'var(--vscode-editor-font-family)',
      },
      fontSize: {
        vscode: 'var(--vscode-font-size)',
        'vscode-editor': 'var(--vscode-editor-font-size)',
      },
      borderRadius: {
        DEFAULT: '4px',
      },
    },
  },
  plugins: [],
};

