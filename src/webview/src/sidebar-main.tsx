import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { SidebarApp } from './SidebarApp';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App>
      <SidebarApp />
    </App>
  </React.StrictMode>
);

