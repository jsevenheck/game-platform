import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stub a sessionStorage-like global so the composable's try/catch storage works.
function installSessionStorage() {
  const store = new Map<string, string>();
  (globalThis as { sessionStorage: Storage }).sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
}

// Mocked router/route state, swapped per test.
let routeStub: { query: Record<string, unknown> };
const routerReplace = vi.fn();

vi.mock('vue-router', () => ({
  useRoute: () => routeStub,
  useRouter: () => ({ replace: routerReplace }),
}));

import {
  normalizeHomeTab,
  resolveInitialHomeTab,
  useHomeTabs,
} from '../src/composables/useHomeTabs';

describe('homeTabs pure helpers', () => {
  it('normalizeHomeTab accepts valid tabs and rejects others', () => {
    expect(normalizeHomeTab('browse')).toBe('browse');
    expect(normalizeHomeTab('host')).toBe('host');
    expect(normalizeHomeTab('join')).toBe('join');
    expect(normalizeHomeTab('garbage')).toBeNull();
    expect(normalizeHomeTab('')).toBeNull();
    expect(normalizeHomeTab(undefined)).toBeNull();
    expect(normalizeHomeTab(123)).toBeNull();
    expect(normalizeHomeTab(null)).toBeNull();
  });

  it('resolveInitialHomeTab: valid query wins over storage', () => {
    expect(resolveInitialHomeTab('join', 'host')).toBe('join');
  });

  it('resolveInitialHomeTab: invalid query falls back to valid storage', () => {
    expect(resolveInitialHomeTab('garbage', 'host')).toBe('host');
    expect(resolveInitialHomeTab(undefined, 'join')).toBe('join');
  });

  it('resolveInitialHomeTab: invalid everything returns browse', () => {
    expect(resolveInitialHomeTab('garbage', 'nope')).toBe('browse');
    expect(resolveInitialHomeTab(undefined, null)).toBe('browse');
  });
});

describe('useHomeTabs', () => {
  beforeEach(() => {
    installSessionStorage();
    routeStub = { query: {} };
    routerReplace.mockClear();
  });

  it('defaults to browse when query/storage are empty', () => {
    const { activeTab } = useHomeTabs();
    expect(activeTab.value).toBe('browse');
  });

  it('uses a valid query tab on init', () => {
    routeStub = { query: { tab: 'host' } };
    const { activeTab } = useHomeTabs();
    expect(activeTab.value).toBe('host');
  });

  it('falls back to sessionStorage when query is absent', () => {
    sessionStorage.setItem('home.activeTab', 'join');
    const { activeTab } = useHomeTabs();
    expect(activeTab.value).toBe('join');
  });

  it('setTab writes sessionStorage and calls router.replace', () => {
    const { setTab } = useHomeTabs();
    setTab('host');
    expect(sessionStorage.getItem('home.activeTab')).toBe('host');
    expect(routerReplace).toHaveBeenCalledWith({ query: { tab: 'host' } });
  });

  it('setTab ignores an invalid tab', () => {
    const { activeTab, setTab } = useHomeTabs();
    setTab('garbage' as never);
    expect(activeTab.value).toBe('browse');
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it('setTab is a no-op when the tab is unchanged', () => {
    routeStub = { query: { tab: 'host' } };
    const { setTab } = useHomeTabs();
    setTab('host');
    expect(routerReplace).not.toHaveBeenCalled();
  });
});
