import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { TestResult } from '@/types';

interface TestResultsProps {
  results: TestResult[];
}

export const TestResults: React.FC<TestResultsProps> = ({ results }) => {
  if (results.length === 0) {
    return (
      <div className="p-4 text-[var(--vscode-descriptionForeground)]">
        No test results
      </div>
    );
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;

  return (
    <div className="p-4 space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4 pb-3 border-b border-vscode-border">
        {passedCount > 0 && (
          <div className="flex items-center gap-1 text-sm text-vscode-success">
            <CheckCircle2 className="h-4 w-4" />
            {passedCount} passed
          </div>
        )}
        {failedCount > 0 && (
          <div className="flex items-center gap-1 text-sm text-vscode-error">
            <XCircle className="h-4 w-4" />
            {failedCount} failed
          </div>
        )}
      </div>

      {/* Individual results */}
      <div className="space-y-2">
        {results.map((result, index) => (
          <div
            key={index}
            className={`flex items-start gap-2 p-2 rounded ${
              result.passed
                ? 'bg-vscode-success/10 border border-vscode-success/30'
                : 'bg-vscode-error/10 border border-vscode-error/30'
            }`}
          >
            {result.passed ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-vscode-success shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 mt-0.5 text-vscode-error shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm">{result.message}</p>
              {result.error && (
                <p className="text-xs text-vscode-error mt-1 font-mono">{result.error}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

