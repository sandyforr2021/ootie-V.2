import { vi } from 'vitest';
import { config } from '@vue/test-utils';
import accessibleModal from '@/directives/accessibleModal';
import { t, setLocale } from '@/i18n';

// Existing interaction fixtures use Traditional Chinese; locale behavior has its own tests.
setLocale('zh-TW');
config.global.config = { ...(config.global.config || {}), globalProperties: { $t: t } };
vi.stubEnv('VITE_SUPABASE_URL', 'https://unit-test.supabase.co');
vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-only-public-key');
vi.stubEnv('VITE_OOTIE_SUPABASE_PROJECT_REF', 'unit-test');

config.global.directives = {
  ...(config.global.directives || {}),
  'accessible-modal': accessibleModal
};

const createQueryBuilder = () => {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    single: vi.fn(async () => ({ data: null, error: null })),
    then: (resolve) => Promise.resolve({ data: [], error: null }).then(resolve)
  };
  return builder;
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn(async () => ({ data: { user: null, session: null }, error: null })),
      signUp: vi.fn(async () => ({ data: { user: null, session: null }, error: null })),
      signInWithOAuth: vi.fn(async () => ({ data: { provider: 'google', url: 'https://example.test/oauth' }, error: null })),
      signOut: vi.fn(async () => ({ error: null }))
    },
    from: vi.fn(() => createQueryBuilder()),
    rpc: vi.fn(async () => ({ data: null, error: null })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ data: null, error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } })),
        remove: vi.fn(async () => ({ data: [], error: null }))
      }))
    }
  }))
}));

// Any unit test that needs another network service must provide its own mock.
// This guard makes accidental browser/network access deterministic and local.
vi.stubGlobal('fetch', vi.fn(async () => {
  throw new Error('UNMOCKED_NETWORK_REQUEST_BLOCKED');
}));
