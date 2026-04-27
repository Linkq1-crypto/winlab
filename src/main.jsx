import React from 'react';
import ReactDOM from 'react-dom/client';
import HomeShell from './HomeShell';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HomeShell />
  </React.StrictMode>
);
