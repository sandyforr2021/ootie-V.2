const DEVELOPMENT_DEMO_MEDIA_REVISION = 'presentation-v2';

export const withDevelopmentDemoMediaRevision = (value) => {
  const url = String(value || '');
  if (!url.includes('/demo-feed/')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}ootie_media=${DEVELOPMENT_DEMO_MEDIA_REVISION}`;
};
