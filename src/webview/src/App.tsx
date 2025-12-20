import React from 'react';
import { TooltipProvider } from '@/components/ui';

interface AppProps {
  children: React.ReactNode;
}

export const App: React.FC<AppProps> = ({ children }) => {
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-vscode-background text-vscode-foreground">
        {children}
      </div>
    </TooltipProvider>
  );
};

