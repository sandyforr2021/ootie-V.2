const FALLBACK_SRC = '/ootie-icon.svg';

export const installImageFallback = (target = window) => {
  const handleError = (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || image.dataset.ootieFallback === 'true') return;
    image.dataset.ootieFallback = 'true';
    image.classList.add('image-load-failed');
    image.alt = image.alt ? `${image.alt}（圖片暫時無法載入）` : '圖片暫時無法載入';
    image.src = FALLBACK_SRC;
  };
  target.addEventListener('error', handleError, true);
  return () => target.removeEventListener('error', handleError, true);
};
