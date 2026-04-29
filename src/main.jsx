import React from 'react';
import ReactDOM from 'react-dom/client';
import { LabProvider } from './LabContext';
import HomeShell from './HomeShell';
import LegalLayout from './LegalLayout';
import SecurityPage from './pages/SecurityPage';
import ContactPage from './pages/ContactPage';
import StatusPage from './pages/StatusPage';
import HowItWorksPage from './pages/HowItWorksPage';
import BlogPage from './pages/BlogPage';
import FeedbackPage from './pages/FeedbackPage';
import ProfilePublicPage from './pages/ProfilePublicPage';
import AISettings from './AISettings';
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
  if (path === '/profile')       return <ProfilePublicPage />;
  if (path === '/feedback')      return <FeedbackPage />;
  if (path === '/blog' || path.startsWith('/blog/')) return <BlogPage />;
  if (path === '/settings/ai')   return <AISettings />;
  return (
    <LabProvider>
      <HomeShell />
    </LabProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
