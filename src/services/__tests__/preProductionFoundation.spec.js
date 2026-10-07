import { describe, expect, it } from 'vitest';
import { scrubMonitoringContext } from '../monitoring';
import { updateDocumentMeta, updatePublicContentMeta } from '../documentMeta';
import { resolveNotificationTarget } from '../notificationNavigation';
import router from '@/router';

describe('pre-production browser foundation', () => {
  it('scrubs sensitive monitoring context recursively', () => {
    expect(scrubMonitoringContext({ token: 'secret', nested: { password: 'hidden', route: '/settings' } }))
      .toEqual({ token: '[REDACTED]', nested: { password: '[REDACTED]', route: '/settings' } });
  });

  it('applies route-specific title and social metadata', () => {
    updateDocumentMeta({ name: 'Settings' });
    expect(document.title).toBe('帳號設定｜OOTIE');
    expect(document.querySelector('meta[property="og:title"]')?.content).toBe('帳號設定｜OOTIE');
    expect(document.querySelector('meta[name="description"]')?.content).toContain('數位衣櫥');
  });

  it('applies public content metadata without exposing a private route', () => {
    updatePublicContentMeta({ title: '@minji 的 OOTD｜OOTIE', description: '約會穿搭', image: '/demo/ootd/02.webp', url: 'https://preview.example/ootd/public-id' });
    expect(document.title).toBe('@minji 的 OOTD｜OOTIE');
    expect(document.querySelector('meta[property="og:image"]')?.content).toContain('/demo/ootd/02.webp');
    expect(document.querySelector('link[rel="canonical"]')?.href).toBe('https://preview.example/ootd/public-id');
  });

  it('keeps notification deep links inside supported public and member routes', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(resolveNotificationTarget({ event_type: 'OOTD_LIKE', entity_id: id })).toBe(`/ootd/${id}`);
    expect(resolveNotificationTarget({ target_path: `/sos?sos=${id}` })).toBe(`/sos?sos=${id}`);
    expect(resolveNotificationTarget({ target_path: '//malicious.example/steal' })).toBeNull();
    expect(resolveNotificationTarget({ target_path: '/settings?token=secret' })).toBeNull();
  });

  it('provides a branded catch-all route instead of a silent redirect', () => {
    expect(router.getRoutes().some((route) => route.name === 'NotFound' && route.path === '/:pathMatch(.*)*')).toBe(true);
  });
});
