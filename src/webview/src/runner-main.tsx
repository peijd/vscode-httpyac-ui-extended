import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { RunnerApp } from './RunnerApp';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App>
      <RunnerApp />
    </App>
  </React.StrictMode>
);
