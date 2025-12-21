import React, { useEffect, useMemo, useRef } from 'react';
import { EditorState, Extension } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  placeholder as cmPlaceholder,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { linter, lintGutter, Diagnostic } from '@codemirror/lint';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

interface CodeEditorProps {
  value: string;
  language?: 'json' | 'text';
  readOnly?: boolean;
  minHeight?: number;
  maxHeight?: number;
  placeholder?: string;
  onChange?: (value: string) => void;
  onFormat?: () => void;
}

const formatKeymap = (onFormat?: () => void) => {
  if (!onFormat) {
    return [];
  }
  return [
    {
      key: 'Mod-Shift-f',
      run: () => {
        onFormat();
        return true;
      },
    },
  ];
};

const jsonLinter = linter((view) => {
  const text = view.state.doc.toString();
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  try {
    JSON.parse(text);
    return [];
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    const match = message.match(/position\s+(\d+)/iu);
    const position = match ? Number(match[1]) : null;
    const from = position ? Math.min(position, text.length) : 0;
    const to = Math.min(from + 1, text.length);
    const diagnostic: Diagnostic = {
      from,
      to,
      severity: 'error',
      message,
    };
    return [diagnostic];
  }
});

const vscodeHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: 'var(--vscode-symbolIcon-propertyForeground, #9cdcfe)' },
  { tag: tags.string, color: 'var(--vscode-symbolIcon-stringForeground, #ce9178)' },
  { tag: tags.number, color: 'var(--vscode-symbolIcon-numberForeground, #b5cea8)' },
  { tag: tags.bool, color: 'var(--vscode-symbolIcon-booleanForeground, #569cd6)' },
  { tag: tags.null, color: 'var(--vscode-symbolIcon-nullForeground, #569cd6)' },
  { tag: tags.keyword, color: 'var(--vscode-symbolIcon-keywordForeground, #c586c0)' },
  { tag: tags.comment, color: 'var(--vscode-descriptionForeground, #6a9955)' },
]);

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  language = 'text',
  readOnly = false,
  minHeight = 240,
  maxHeight,
  placeholder,
  onChange,
  onFormat,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastValueRef = useRef<string>(value);

  const extensions = useMemo<Extension[]>(() => {
    const editorTheme = EditorView.theme(
      {
        '&': {
          backgroundColor: 'var(--vscode-input-background)',
          color: 'var(--vscode-editor-foreground, var(--vscode-foreground))',
          height: maxHeight ? `${maxHeight}px` : 'auto',
        },
        '.cm-scroller': {
          fontFamily: 'var(--vscode-editor-font-family, Consolas, Monaco, monospace)',
          fontSize: 'var(--vscode-editor-font-size, 13px)',
          lineHeight: '1.5',
        },
        '.cm-content': {
          minHeight: `${minHeight}px`,
        },
        '.cm-gutters': {
          backgroundColor: 'var(--vscode-editor-background)',
          color: 'var(--vscode-editorLineNumber-foreground)',
          borderRight: '1px solid var(--vscode-input-border, transparent)',
        },
        '.cm-lineNumbers .cm-gutterElement': {
          padding: '0 8px 0 12px',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'transparent',
        },
        '.cm-cursor': {
          borderLeftColor: 'var(--vscode-editorCursor-foreground)',
        },
        '.cm-selectionBackground, ::selection': {
          backgroundColor: 'var(--vscode-editor-selectionBackground)',
        },
        '.cm-focused .cm-selectionBackground': {
          backgroundColor: 'var(--vscode-editor-selectionBackground)',
        },
      },
      { dark: true }
    );

    const base = [
      lineNumbers(),
      highlightActiveLineGutter(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab, ...formatKeymap(onFormat)]),
      syntaxHighlighting(vscodeHighlightStyle, { fallback: true }),
      editorTheme,
      EditorView.lineWrapping,
    ];

    if (language === 'json') {
      base.push(json(), jsonLinter, lintGutter());
    }

    if (readOnly) {
      base.push(EditorState.readOnly.of(true));
    }

    if (placeholder) {
      base.push(cmPlaceholder(placeholder));
    }

    return base;
  }, [language, maxHeight, minHeight, onFormat, placeholder, readOnly]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const startState = EditorState.create({
      doc: value,
      extensions: [
        ...extensions,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const text = update.state.doc.toString();
            lastValueRef.current = text;
            onChange?.(text);
          }
        }),
      ],
    });
    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [extensions, onChange]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    if (value === lastValueRef.current) {
      return;
    }
    lastValueRef.current = value;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }, [value]);

  return <div ref={containerRef} className="ui-card overflow-hidden" />;
};
