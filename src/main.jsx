import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import HomeShell from './HomeShell';
import { LabProvider } from './LabContext';
import { registerWinLabPWA } from './pwa/registerPWA';
import './index.css';

const LegalLayout = lazy(() => import('./LegalLayout'));
const SecurityPage = lazy(() => import('./pages/SecurityPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const StatusPage = lazy(() => import('./pages/StatusPage'));
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'));
const EnterprisePage = lazy(() => import('./pages/EnterprisePage'));
const ProfilePublicPage = lazy(() => import('./pages/ProfilePublicPage'));
const AISettings = lazy(() => import('./AISettings'));

registerWinLabPWA();

const path = window.location.pathname;

function RouteShell() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-6 text-center text-xs font-mono uppercase tracking-[0.28em] text-zinc-500">
      <div className="animate-pulse">loading route shell</div>
    </div>
  );
}

function App() {
  if (path === '/privacy') {
    return (
      <Suspense fallback={<RouteShell />}>
        <LegalLayout initialTab="privacy" onBack={() => { window.location.href = '/'; }} />
      </Suspense>
    );
  }
  if (path === '/terms') {
    return (
      <Suspense fallback={<RouteShell />}>
        <LegalLayout initialTab="terms" onBack={() => { window.location.href = '/'; }} />
      </Suspense>
    );
  }
  if (path === '/security') {
    return <Suspense fallback={<RouteShell />}><SecurityPage /></Suspense>;
  }
  if (path === '/contact') {
    return <Suspense fallback={<RouteShell />}><ContactPage /></Suspense>;
  }
  if (path === '/status') {
    return <Suspense fallback={<RouteShell />}><StatusPage /></Suspense>;
  }
  if (path === '/how-it-works') {
    return <Suspense fallback={<RouteShell />}><HowItWorksPage /></Suspense>;
  }
  if (path === '/profile') {
    return <Suspense fallback={<RouteShell />}><ProfilePublicPage /></Suspense>;
  }
  if (path === '/feedback') {
    return <Suspense fallback={<RouteShell />}><FeedbackPage /></Suspense>;
  }
  if (path === '/forum') {
    return <Suspense fallback={<RouteShell />}><FeedbackPage /></Suspense>;
  }
  if (path === '/enterprise') {
    return <Suspense fallback={<RouteShell />}><EnterprisePage /></Suspense>;
  }
  if (path === '/blog' || path.startsWith('/blog/')) {
    return <Suspense fallback={<RouteShell />}><BlogPage /></Suspense>;
  }
  if (path === '/settings/ai') {
    return <Suspense fallback={<RouteShell />}><AISettings /></Suspense>;
  }
  return (
    <HomeShell />
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LabProvider>
      <App />
    </LabProvider>
  </React.StrictMode>
);
