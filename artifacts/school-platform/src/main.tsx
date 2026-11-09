import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function ResaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const dismissed = window.localStorage.getItem('resa-install-prompt-dismissed') === '1';
    if (standalone || dismissed) return;

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(ios);
    setVisible(true);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      window.localStorage.setItem('resa-install-prompt-dismissed', '1');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    window.localStorage.setItem('resa-install-prompt-dismissed', '1');
  };

  const install = async () => {
    if (!installEvent) {
      setShowInstructions((current) => !current);
      return;
    }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    if (choice.outcome === 'accepted') setVisible(false);
    else setShowInstructions(true);
  };

  if (!visible) return null;

  return (
    <aside
      aria-label="Install RESA app"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-xl rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5"
      role="region"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-900 text-lg font-black text-white">
          RESA
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900">Install the RESA School App</p>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            Add RESA to your home screen for quick, app-like access to the school portal.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void install()}
              className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
            >
              {installEvent ? 'Install app' : 'How to install'}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            >
              Not now
            </button>
          </div>
          {showInstructions && (
            <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-950">
              {isIOS
                ? 'On iPhone or iPad: open this page in Safari, tap the Share button, choose “Add to Home Screen”, then tap “Add”.'
                : 'In Chrome or Edge: open the browser menu (⋮), choose “Install app” or “Add to Home screen”, and confirm. If the option is unavailable, keep using RESA in your browser.'}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="Close install invitation"
          onClick={dismiss}
          className="rounded-md px-2 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100"
        >
          ×
        </button>
      </div>
    </aside>
  );
}


// Recover once from Vite dynamic-import/preload failures. This commonly occurs
// when a phone keeps an older HTML/app shell after a new deployment while the
// referenced hashed JavaScript chunks have already changed. The retry is
// session-scoped and time-limited so a genuinely broken module cannot cause
// an endless reload loop.
const PRELOAD_RETRY_KEY = 'resa-vite-preload-retry-at';
const PRELOAD_RETRY_WINDOW_MS = 30_000;

window.addEventListener('vite:preloadError', (event: Event) => {
  event.preventDefault();

  let lastRetryAt = 0;
  try {
    lastRetryAt = Number(window.sessionStorage.getItem(PRELOAD_RETRY_KEY) || 0);
  } catch {
    // Storage can be unavailable in private browsing; fall through to the
    // normal React error boundary rather than risking repeated reloads.
  }

  if (Date.now() - lastRetryAt > PRELOAD_RETRY_WINDOW_MS) {
    try {
      window.sessionStorage.setItem(PRELOAD_RETRY_KEY, String(Date.now()));
      window.location.reload();
      return;
    } catch {
      // If storage or navigation is blocked, the error boundary remains the
      // recovery path and the page stays usable.
    }
  }

  console.error(
    'RESA could not load a page module after its one automatic recovery attempt.',
    event,
  );
});

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
    <>
      <App />
      <ResaInstallPrompt />
    </>
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
