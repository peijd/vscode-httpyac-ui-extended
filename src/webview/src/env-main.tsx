/* eslint-env browser */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { EnvSnapshotApp } from './EnvSnapshotApp';
import './index.css';

const rootElement = typeof document !== 'undefined' ? document.getElementById('root') : null;
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App>
        <EnvSnapshotApp />
      </App>
    </React.StrictMode>
  );
}
