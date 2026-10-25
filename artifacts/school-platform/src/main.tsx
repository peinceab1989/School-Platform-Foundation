import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('RESA app root element was not found.');
}

createRoot(rootElement, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

// Register the RESA service worker in production only.
if (
  import.meta.env.PROD &&
  'serviceWorker' in navigator
) {
  window.addEventListener('load', () => {
    const baseUrl = import.meta.env.BASE_URL;
    const serviceWorkerUrl = `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}sw.js`;

    navigator.serviceWorker
      .register(serviceWorkerUrl)
      .catch((error) => {
        console.error('RESA service worker registration failed:', error);
      });
  });
}