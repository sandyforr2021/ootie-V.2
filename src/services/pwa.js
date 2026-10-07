let deferredInstallPrompt = null;
const listeners = new Set();

const notify = () => listeners.forEach((listener) => listener(Boolean(deferredInstallPrompt)));

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    notify();
  });
}

export const subscribeToInstallAvailability = (listener) => {
  listeners.add(listener);
  listener(Boolean(deferredInstallPrompt));
  return () => listeners.delete(listener);
};

export const requestPwaInstall = async () => {
  if (!deferredInstallPrompt) return 'UNAVAILABLE';
  const prompt = deferredInstallPrompt;
  deferredInstallPrompt = null;
  notify();
  await prompt.prompt();
  const choice = await prompt.userChoice;
  return choice?.outcome === 'accepted' ? 'ACCEPTED' : 'DISMISSED';
};

export const registerPwa = async () => {
  if (!('serviceWorker' in navigator) || import.meta.env.MODE === 'test') return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (error) {
    window.dispatchEvent(new CustomEvent('ootie:service-error', { detail: { kind: 'pwa', message: '離線功能暫時無法啟用。' } }));
    return null;
  }
};
