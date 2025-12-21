import React from 'react';

interface JsonHighlighterProps {
  json: string;
  showLineNumbers?: boolean;
}

export const JsonHighlighter: React.FC<JsonHighlighterProps> = ({ json, showLineNumbers = true }) => {
  const lines = json.split('\n');

  return (
    <code className="block">
      {lines.map((line, i) => (
        <div key={i} className="flex">
          {showLineNumbers ? (
            <span className="select-none text-[var(--vscode-editorLineNumber-foreground)] pr-4 text-right w-8 shrink-0">
              {i + 1}
            </span>
          ) : null}
          <span className="flex-1">
            {highlightJsonLine(line)}
          </span>
        </div>
      ))}
    </code>
  );
};

function highlightJsonLine(line: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let key = 0;

  const stringRegex = /"([^"\\]|\\.)*"/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = stringRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      const before = line.slice(lastIndex, match.index);
      parts.push(
        <span key={key++}>
          {highlightNonString(before)}
        </span>
      );
    }

    const afterMatch = line.slice(match.index + match[0].length);
    const isKey = afterMatch.trimStart().startsWith(':');

    parts.push(
      <span
        key={key++}
        className={
          isKey
            ? 'text-[var(--vscode-symbolIcon-propertyForeground)]'
            : 'text-[var(--vscode-symbolIcon-stringForeground)]'
        }
      >
        {match[0]}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) {
    parts.push(
      <span key={key++}>
        {highlightNonString(line.slice(lastIndex))}
      </span>
    );
  }

  return parts.length > 0 ? parts : line;
}

function highlightNonString(text: string): React.ReactNode {
  return text.split(/(\b(?:true|false|null|\d+(?:\.\d+)?)\b)/g).map((part, i) => {
    if (/^(true|false)$/.test(part)) {
      return <span key={i} className="text-[var(--vscode-symbolIcon-booleanForeground)]">{part}</span>;
    }
    if (/^null$/.test(part)) {
      return <span key={i} className="text-[var(--vscode-symbolIcon-nullForeground)]">{part}</span>;
    }
    if (/^\d+(?:\.\d+)?$/.test(part)) {
      return <span key={i} className="text-[var(--vscode-symbolIcon-numberForeground)]">{part}</span>;
    }
    return part;
  });
}
