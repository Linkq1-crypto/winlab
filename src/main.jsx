import React from 'react';
import ReactDOM from 'react-dom/client';
import HomeShell from './HomeShell';
import LegalLayout from './LegalLayout';
import SecurityPage from './pages/SecurityPage';
import ContactPage from './pages/ContactPage';
import StatusPage from './pages/StatusPage';
import HowItWorksPage from './pages/HowItWorksPage';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

const path = window.location.pathname;

function App() {
  if (path === '/privacy')       return <LegalLayout initialTab="privacy" onBack={() => { window.location.href = '/'; }} />;
  if (path === '/terms')         return <LegalLayout initialTab="terms"   onBack={() => { window.location.href = '/'; }} />;
  if (path === '/security')      return <SecurityPage />;
  if (path === '/contact')       return <ContactPage />;
  if (path === '/status')        return <StatusPage />;
  if (path === '/how-it-works')  return <HowItWorksPage />;
  return <HomeShell />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
