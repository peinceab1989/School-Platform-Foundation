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
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem('resa-install-prompt-dismissed') === '1';
    } catch {
      // Installation guidance remains available when browser storage is restricted.
    }
    if (standalone || dismissed) return;

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const mac = /Macintosh|MacIntel|MacPPC|Mac68K/.test(navigator.platform) && !ios;
    setIsIOS(ios);
    setIsMac(mac);
    setVisible(true);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      try {
        window.localStorage.setItem('resa-install-prompt-dismissed', '1');
      } catch {
        // The app is installed even if storage is unavailable.
      }
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
    try {
      window.localStorage.setItem('resa-install-prompt-dismissed', '1');
    } catch {
      // Dismissing the prompt should not fail in private browsing.
    }
  };

  const install = async () => {
    if (!installEvent) {
      setShowInstructions((current) => !current);
      return;
    }
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      setInstallEvent(null);
      if (choice.outcome === 'accepted') setVisible(false);
      else setShowInstructions(true);
    } catch (error) {
      console.error('RESA installation prompt could not be opened:', error);
      setShowInstructions(true);
    }
  };

  const installInstructions = isIOS
    ? 'On iPhone or iPad: open RESA in Safari, tap the Share button, choose “Add to Home Screen”, turn on “Open as Web App” if shown, then tap “Add”.'
    : isMac
      ? 'On a Mac: in Safari on supported macOS versions, choose File > Add to Dock. In Chrome or Edge, open the browser menu and choose Install RESA.'
      : 'On Android: use Chrome and tap Install when prompted, or open the browser menu and choose “Install app” or “Add to Home screen”. On Windows: use Chrome or Edge and choose “Install RESA” from the address bar or browser menu.';

  if (!visible) return null;

  return (
    <aside
      aria-label="Install RESA app"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-xl rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5"
      role="region"
    >
      <div className="flex items-start gap-3">
        <img
          src="/icons/resa-app-192.svg"
          alt=""
          className="h-12 w-12 shrink-0 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900">Install the RESA School App</p>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            Add RESA to your device for quick, app-like access to the school portal.
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
              {installInstructions}
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

const PRELOAD_RETRY_KEY = 'resa-vite-preload-retry-at';
const PRELOAD_RETRY_WINDOW_MS = 30_000;

window.addEventListener('vite:preloadError', (event: Event) => {
  event.preventDefault();
  let lastRetryAt = 0;
  try {
    lastRetryAt = Number(window.sessionStorage.getItem(PRELOAD_RETRY_KEY) || 0);
  } catch {
    // Storage can be unavailable in private browsing.
  }
  if (Date.now() - lastRetryAt > PRELOAD_RETRY_WINDOW_MS) {
    try {
      window.sessionStorage.setItem(PRELOAD_RETRY_KEY, String(Date.now()));
      window.location.reload();
      return;
    } catch {
      // Fall through to the React error boundary.
    }
  }
  console.error('RESA could not load a page module after its one automatic recovery attempt.', event);
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('RESA app root element was not found.');

createRoot(rootElement, {
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

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const baseUrl = import.meta.env.BASE_URL;
    const serviceWorkerUrl = `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}sw.js`;
    navigator.serviceWorker.register(serviceWorkerUrl).catch((error) => {
      console.error('RESA service worker registration failed:', error);
    });
  });
}