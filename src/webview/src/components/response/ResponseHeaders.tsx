import React from 'react';

interface ResponseHeadersProps {
  headers: Record<string, string>;
}

export const ResponseHeaders: React.FC<ResponseHeadersProps> = ({ headers }) => {
  const entries = Object.entries(headers);

  if (entries.length === 0) {
    return (
      <div className="p-4 text-[var(--vscode-descriptionForeground)]">
        No headers in response
      </div>
    );
  }

  return (
    <div className="p-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-vscode-border">
            <th className="text-left py-2 pr-4 font-semibold text-[var(--vscode-descriptionForeground)]">
              Header
            </th>
            <th className="text-left py-2 font-semibold text-[var(--vscode-descriptionForeground)]">
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} className="border-b border-vscode-border/50 hover:bg-vscode-list-hover">
              <td className="py-2 pr-4 font-mono text-vscode-link">{key}</td>
              <td className="py-2 font-mono break-all">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

