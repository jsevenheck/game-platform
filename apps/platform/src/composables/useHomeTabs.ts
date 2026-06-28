import { ref, watch, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

export type HomeTabId = 'browse' | 'host' | 'join';

export interface HomeTab {
  id: HomeTabId;
  label: string;
  icon: string;
}

export const HOME_TABS: readonly HomeTab[] = [
  { id: 'browse', label: 'Browse Games', icon: '🎮' },
  { id: 'host', label: 'Host a Party', icon: '⚡' },
  { id: 'join', label: 'Join with Code', icon: '🔗' },
];

const VALID_TABS: ReadonlySet<HomeTabId> = new Set(['browse', 'host', 'join']);
const STORAGE_KEY = 'home.activeTab';

/** Normalize an arbitrary value into a valid tab id, or `null` if invalid. */
export function normalizeHomeTab(value: unknown): HomeTabId | null {
  return typeof value === 'string' && VALID_TABS.has(value as HomeTabId)
    ? (value as HomeTabId)
    : null;
}

/**
 * Resolve the initial active tab. Precedence:
 *   1. valid `queryValue` (URL `?tab=`);
 *   2. valid `storedValue` (sessionStorage);
 *   3. fallback `'browse'`.
 */
export function resolveInitialHomeTab(queryValue: unknown, storedValue: unknown): HomeTabId {
  return normalizeHomeTab(queryValue) ?? normalizeHomeTab(storedValue) ?? 'browse';
}

function readStoredTab(): unknown {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredTab(tab: HomeTabId): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, tab);
  } catch {
    /* ignore storage errors (private mode, etc.) */
  }
}

/**
 * Owns the active home tab. Syncs to sessionStorage and the URL query.
 *
 * `setTab` is user-driven and writes both storage and the router (using
 * `router.replace` so Back doesn't step through tab switches). A watcher reacts
 * to browser navigation (Back/Forward, deep links) and updates state without
 * writing router state, never clobbering the current tab on an absent/invalid
 * query.
 */
export function useHomeTabs(): { activeTab: Ref<HomeTabId>; setTab: (next: HomeTabId) => void } {
  const route = useRoute();
  const router = useRouter();

  const activeTab = ref<HomeTabId>(resolveInitialHomeTab(route.query.tab, readStoredTab()));

  function setTab(next: HomeTabId): void {
    if (!VALID_TABS.has(next) || next === activeTab.value) return;
    activeTab.value = next;
    writeStoredTab(next);
    if (normalizeHomeTab(route.query.tab) !== next) {
      router.replace({ query: { ...route.query, tab: next } });
    }
  }

  watch(
    () => route.query.tab,
    (queryTab) => {
      const resolved = normalizeHomeTab(queryTab);
      // Only follow valid, different query tabs. Absent/invalid query never
      // clobbers the current tab.
      if (resolved && resolved !== activeTab.value) {
        activeTab.value = resolved;
        writeStoredTab(resolved);
      }
    }
  );

  return { activeTab, setTab };
}
