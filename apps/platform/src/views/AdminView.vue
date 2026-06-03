<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';

interface AdminLog {
  timestamp: string;
  level: string;
  msg: string;
  component?: string;
  namespace?: string;
  requestId?: string;
}

interface AdminPartyMember {
  playerId: string;
  name: string;
  connected: boolean;
  isHost: boolean;
}

interface AdminParty {
  partyId: string;
  inviteCode: string;
  hostPlayerId: string;
  status: 'lobby' | 'launching' | 'in-match' | 'returning';
  selectedGameId: string | null;
  activeMatch: {
    gameId: string;
    matchKey: string;
    namespace: string;
    startedAt: number;
  } | null;
  members: AdminPartyMember[];
  memberCount: number;
  connectedMemberCount: number;
}

const props = defineProps<{ section?: string }>();

const activeSection = computed(() => (props.section === 'parties' ? 'parties' : 'logs'));

const authenticated = ref(false);
const checkingAuth = ref(true);
const csrfToken = ref('');

const username = ref('');
const password = ref('');
const loginError = ref('');
const loggingIn = ref(false);

const logs = ref<AdminLog[]>([]);
const loadingLogs = ref(false);
const parties = ref<AdminParty[]>([]);
const loadingParties = ref(false);
const selectedPartyId = ref('');
const kickingPlayerId = ref('');
const actionMessage = ref('');
const errorMessage = ref('');

const levelFilter = ref('');
const componentFilter = ref('');
const searchQuery = ref('');
const autoRefresh = ref(false);

let refreshInterval: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  await checkAuth();
});

async function checkAuth(): Promise<void> {
  checkingAuth.value = true;
  try {
    const res = await fetch('/api/admin/me', { credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      authenticated.value = true;
      csrfToken.value = typeof json.csrfToken === 'string' ? json.csrfToken : '';
      await fetchActiveSection();
    } else {
      authenticated.value = false;
      csrfToken.value = '';
    }
  } catch {
    authenticated.value = false;
    csrfToken.value = '';
  } finally {
    checkingAuth.value = false;
  }
}

async function doLogin(): Promise<void> {
  loginError.value = '';
  loggingIn.value = true;
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        username: username.value.trim(),
        password: password.value,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      loginError.value = json.error ?? 'Login failed';
      return;
    }
    authenticated.value = true;
    csrfToken.value = typeof json.csrfToken === 'string' ? json.csrfToken : '';
    password.value = '';
    await fetchActiveSection();
  } catch {
    loginError.value = 'Request failed during login';
  } finally {
    loggingIn.value = false;
  }
}

async function doLogout(): Promise<void> {
  try {
    await fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // ignore
  }
  authenticated.value = false;
  csrfToken.value = '';
  logs.value = [];
  parties.value = [];
  selectedPartyId.value = '';
  autoRefresh.value = false;
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

const filteredLogs = computed(() => {
  let result = logs.value;
  if (levelFilter.value) {
    result = result.filter((l) => l.level === levelFilter.value);
  }
  if (componentFilter.value) {
    const c = componentFilter.value.toLowerCase();
    result = result.filter((l) => l.component?.toLowerCase().includes(c));
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter((l) => l.msg.toLowerCase().includes(q));
  }
  return result;
});

const uniqueLevels = computed(() => {
  const levels = new Set(logs.value.map((l) => l.level));
  return Array.from(levels).sort();
});

const selectedParty = computed(() => {
  return parties.value.find((party) => party.partyId === selectedPartyId.value) ?? null;
});

async function fetchActiveSection(): Promise<void> {
  if (activeSection.value === 'parties') {
    await fetchParties();
  } else {
    await fetchLogs();
  }
}

watch(activeSection, async () => {
  if (activeSection.value !== 'logs' && refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    autoRefresh.value = false;
  }

  if (!authenticated.value) return;
  actionMessage.value = '';
  errorMessage.value = '';
  await fetchActiveSection();
});

function buildQueryParams(): URLSearchParams {
  const params = new URLSearchParams();
  params.set('limit', '500');
  if (levelFilter.value) params.set('level', levelFilter.value);
  if (componentFilter.value) params.set('component', componentFilter.value);
  if (searchQuery.value) params.set('search', searchQuery.value);
  return params;
}

async function fetchLogs(): Promise<void> {
  errorMessage.value = '';
  actionMessage.value = '';
  loadingLogs.value = true;
  try {
    const res = await fetch(`/api/admin/logs?${buildQueryParams().toString()}`, {
      credentials: 'include',
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      errorMessage.value = json.error ?? 'Failed to load logs';
      if (res.status === 401) {
        authenticated.value = false;
        csrfToken.value = '';
      }
      return;
    }
    logs.value = json.logs;
  } catch {
    errorMessage.value = 'Request failed while loading logs';
  } finally {
    loadingLogs.value = false;
  }
}

async function fetchParties(): Promise<void> {
  errorMessage.value = '';
  loadingParties.value = true;
  try {
    const res = await fetch('/api/admin/parties', { credentials: 'include' });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      errorMessage.value = json.error ?? 'Failed to load parties';
      if (res.status === 401) {
        authenticated.value = false;
        csrfToken.value = '';
      }
      return;
    }

    parties.value = Array.isArray(json.parties) ? json.parties : [];
    if (!parties.value.some((party) => party.partyId === selectedPartyId.value)) {
      selectedPartyId.value = parties.value[0]?.partyId ?? '';
    }
  } catch {
    errorMessage.value = 'Request failed while loading parties';
  } finally {
    loadingParties.value = false;
  }
}

async function kickMember(member: AdminPartyMember): Promise<void> {
  if (!selectedParty.value) return;
  if (!confirm(`Remove ${member.name} from party ${selectedParty.value.inviteCode}?`)) return;

  errorMessage.value = '';
  actionMessage.value = '';
  kickingPlayerId.value = member.playerId;
  try {
    const res = await fetch(
      `/api/admin/parties/${selectedParty.value.partyId}/members/${member.playerId}/kick`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken.value,
        },
        credentials: 'include',
        body: JSON.stringify({ csrfToken: csrfToken.value }),
      }
    );
    const json = await res.json();
    if (!res.ok || !json.ok) {
      errorMessage.value = json.error ?? 'Kick failed';
      if (res.status === 401) {
        authenticated.value = false;
        csrfToken.value = '';
      }
      return;
    }

    actionMessage.value = `${member.name} was removed from the party.`;
    await fetchParties();
  } catch {
    errorMessage.value = 'Request failed while kicking player';
  } finally {
    kickingPlayerId.value = '';
  }
}

async function cleanupAll(): Promise<void> {
  errorMessage.value = '';
  actionMessage.value = '';
  if (!confirm('Delete ALL parties and disconnect every connected player?')) return;

  const res = await fetch('/api/admin/cleanup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken.value,
    },
    credentials: 'include',
    body: JSON.stringify({ csrfToken: csrfToken.value }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    errorMessage.value = json.error ?? 'Cleanup failed';
    if (res.status === 401) {
      authenticated.value = false;
      csrfToken.value = '';
    }
    return;
  }

  actionMessage.value = `Cleanup complete. Removed ${json.partiesRemoved} parties and ${json.membersRemoved} members.`;
  parties.value = [];
  selectedPartyId.value = '';
  await fetchActiveSection();
}

function toggleAutoRefresh(): void {
  autoRefresh.value = !autoRefresh.value;
  if (autoRefresh.value) {
    refreshInterval = setInterval(fetchLogs, 5000);
  } else if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval);
});

function levelBadgeClass(level: string): string {
  switch (level) {
    case 'fatal':
    case 'error':
      return 'bg-danger text-white';
    case 'warn':
      return 'bg-warning text-black';
    case 'info':
      return 'bg-success text-white';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function statusBadgeClass(status: AdminParty['status']): string {
  switch (status) {
    case 'in-match':
      return 'bg-accent text-white';
    case 'returning':
    case 'launching':
      return 'bg-warning text-black';
    case 'lobby':
      return 'bg-success text-white';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function memberStatusClass(connected: boolean): string {
  return connected ? 'bg-success text-white' : 'bg-muted text-muted-foreground';
}

function formatStartedAt(startedAt: number): string {
  return new Date(startedAt).toLocaleString();
}
</script>

<template>
  <main
    class="mx-auto flex w-full flex-col gap-4 p-6"
    :class="authenticated ? 'max-w-7xl' : 'min-h-[calc(100vh-2rem)] max-w-md justify-center'"
  >
    <header class="ui-panel p-5">
      <h1 class="text-xl font-semibold">Admin Console</h1>
      <p class="text-sm text-muted-foreground">
        Secure endpoint for server logs, active party management and emergency cleanup.
      </p>
    </header>

    <!-- Loading state -->
    <section v-if="checkingAuth" class="ui-panel w-full p-5 text-sm text-muted-foreground">
      Checking session…
    </section>

    <!-- Login form -->
    <section v-else-if="!authenticated" class="ui-panel flex w-full flex-col gap-4 p-5">
      <h2 class="text-lg font-medium">Admin Login</h2>
      <label class="flex flex-col gap-1 text-sm">
        Username
        <input
          v-model="username"
          type="text"
          class="ui-input"
          placeholder="admin"
          @keyup.enter="doLogin"
        />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        Password
        <input
          v-model="password"
          type="password"
          class="ui-input"
          placeholder="Password"
          @keyup.enter="doLogin"
        />
      </label>
      <button
        class="ui-btn-primary"
        :disabled="loggingIn || !username.trim() || !password"
        @click="doLogin"
      >
        {{ loggingIn ? 'Signing in…' : 'Sign In' }}
      </button>
      <p v-if="loginError" class="border border-danger bg-danger-muted p-3 text-sm text-danger">
        {{ loginError }}
      </p>
    </section>

    <!-- Dashboard -->
    <template v-else>
      <section class="ui-panel flex flex-wrap items-center gap-3 p-5">
        <nav class="ui-tab-group min-w-64" aria-label="Admin sections">
          <RouterLink
            to="/admin/logs"
            class="ui-tab no-underline"
            :class="{ 'ui-tab-active': activeSection === 'logs' }"
          >
            Logs
          </RouterLink>
          <RouterLink
            to="/admin/parties"
            class="ui-tab no-underline"
            :class="{ 'ui-tab-active': activeSection === 'parties' }"
          >
            Parties
          </RouterLink>
        </nav>

        <button
          v-if="activeSection === 'logs'"
          class="ui-btn-secondary"
          :disabled="loadingLogs"
          @click="fetchLogs"
        >
          {{ loadingLogs ? 'Loading…' : 'Refresh Logs' }}
        </button>
        <button
          v-if="activeSection === 'logs'"
          class="ui-btn-secondary"
          :class="{ 'admin-auto-refresh-active': autoRefresh }"
          @click="toggleAutoRefresh"
        >
          {{ autoRefresh ? 'Stop Auto-Refresh' : 'Auto-Refresh (5s)' }}
        </button>
        <button
          v-if="activeSection === 'parties'"
          class="ui-btn-secondary"
          :disabled="loadingParties"
          @click="fetchParties"
        >
          {{ loadingParties ? 'Loading…' : 'Refresh Parties' }}
        </button>
        <button class="ui-btn-danger" @click="cleanupAll">Delete All Parties</button>
        <button class="ui-btn-ghost ml-auto" @click="doLogout">Logout</button>
      </section>

      <section v-if="activeSection === 'logs'" class="ui-panel flex flex-wrap gap-3 p-4">
        <label class="flex flex-col gap-1 text-xs">
          Level
          <select v-model="levelFilter" class="ui-input text-sm admin-select" @change="fetchLogs">
            <option value="">All</option>
            <option v-for="lvl in uniqueLevels" :key="lvl" :value="lvl">{{ lvl }}</option>
          </select>
        </label>
        <label class="flex flex-col gap-1 text-xs">
          Component
          <input
            v-model="componentFilter"
            type="text"
            class="ui-input text-sm"
            placeholder="e.g. party"
            @keyup.enter="fetchLogs"
          />
        </label>
        <label class="flex flex-col gap-1 text-xs">
          Search
          <input
            v-model="searchQuery"
            type="text"
            class="ui-input text-sm"
            placeholder="Message contains…"
            @keyup.enter="fetchLogs"
          />
        </label>
      </section>

      <p
        v-if="errorMessage"
        class="ui-panel border border-danger bg-danger-muted p-3 text-sm text-danger"
      >
        {{ errorMessage }}
      </p>
      <p
        v-if="actionMessage"
        class="ui-panel border border-success bg-success-muted p-3 text-sm text-success"
      >
        {{ actionMessage }}
      </p>

      <section v-if="activeSection === 'parties'" class="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div class="ui-panel p-0">
          <div class="border-b border-border px-4 py-3">
            <h2 class="text-sm font-semibold">Active Parties</h2>
            <p class="text-xs text-muted-foreground">
              {{ parties.length }} parties currently stored on the server.
            </p>
          </div>

          <div v-if="parties.length" class="max-h-[68vh] overflow-auto p-3">
            <button
              v-for="party in parties"
              :key="party.partyId"
              class="admin-party-card"
              :class="{ 'admin-party-card-active': selectedPartyId === party.partyId }"
              @click="selectedPartyId = party.partyId"
            >
              <span class="flex items-center justify-between gap-2">
                <span class="font-mono text-base font-semibold tracking-[0.18em]">
                  {{ party.inviteCode }}
                </span>
                <span class="ui-badge" :class="statusBadgeClass(party.status)">
                  {{ party.status }}
                </span>
              </span>
              <span class="text-xs text-muted-foreground">
                {{ party.connectedMemberCount }}/{{ party.memberCount }} connected
              </span>
              <span v-if="party.activeMatch" class="text-xs text-muted-foreground">
                Match: {{ party.activeMatch.gameId }}
              </span>
            </button>
          </div>
          <p v-else class="p-4 text-sm text-muted-foreground">
            {{ loadingParties ? 'Loading parties…' : 'No active parties.' }}
          </p>
        </div>

        <div v-if="selectedParty" class="ui-panel p-0">
          <div class="border-b border-border px-4 py-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="font-mono text-lg font-semibold tracking-[0.18em]">
                  {{ selectedParty.inviteCode }}
                </h2>
                <p class="text-xs text-muted-foreground">Party ID: {{ selectedParty.partyId }}</p>
              </div>
              <span class="ui-badge" :class="statusBadgeClass(selectedParty.status)">
                {{ selectedParty.status }}
              </span>
            </div>
          </div>

          <div class="grid gap-4 p-4 lg:grid-cols-[1fr_280px]">
            <section>
              <h3 class="ui-section-label">Players</h3>
              <div class="flex flex-col gap-2">
                <div
                  v-for="member in selectedParty.members"
                  :key="member.playerId"
                  class="admin-member-row"
                >
                  <div>
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="font-medium">{{ member.name }}</span>
                      <span v-if="member.isHost" class="ui-badge bg-accent text-white">Host</span>
                      <span class="ui-badge" :class="memberStatusClass(member.connected)">
                        {{ member.connected ? 'Online' : 'Offline' }}
                      </span>
                    </div>
                    <p class="font-mono text-xs text-muted-foreground">{{ member.playerId }}</p>
                  </div>
                  <button
                    class="ui-btn-danger"
                    :disabled="kickingPlayerId === member.playerId"
                    @click="kickMember(member)"
                  >
                    {{ kickingPlayerId === member.playerId ? 'Kicking…' : 'Kick' }}
                  </button>
                </div>
              </div>
            </section>

            <aside class="admin-party-meta">
              <h3 class="ui-section-label">Party Details</h3>
              <dl class="space-y-3 text-sm">
                <div>
                  <dt class="text-xs text-muted-foreground">Selected game</dt>
                  <dd>{{ selectedParty.selectedGameId ?? 'None' }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-muted-foreground">Members</dt>
                  <dd>
                    {{ selectedParty.connectedMemberCount }}/{{ selectedParty.memberCount }}
                    connected
                  </dd>
                </div>
                <div v-if="selectedParty.activeMatch">
                  <dt class="text-xs text-muted-foreground">Active match</dt>
                  <dd>{{ selectedParty.activeMatch.gameId }}</dd>
                  <dd class="font-mono text-xs text-muted-foreground">
                    {{ selectedParty.activeMatch.matchKey }}
                  </dd>
                  <dd class="text-xs text-muted-foreground">
                    Started {{ formatStartedAt(selectedParty.activeMatch.startedAt) }}
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        </div>

        <div v-else class="ui-panel p-5 text-sm text-muted-foreground">
          Select a party to manage its players.
        </div>
      </section>

      <section v-if="activeSection === 'logs'" class="ui-panel p-0">
        <div class="border-b border-border px-4 py-3 text-sm font-medium">
          Recent Logs
          <span v-if="filteredLogs.length" class="text-muted-foreground">
            ({{ filteredLogs.length }})
          </span>
        </div>
        <div class="max-h-[60vh] overflow-auto">
          <table v-if="filteredLogs.length" class="w-full text-left text-xs">
            <thead class="bg-shell sticky top-0">
              <tr>
                <th class="px-4 py-3 font-medium">Time</th>
                <th class="px-4 py-3 font-medium">Level</th>
                <th class="px-4 py-3 font-medium">Component</th>
                <th class="px-4 py-3 font-medium">Namespace</th>
                <th class="px-4 py-3 font-medium">Message</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr v-for="(log, idx) in filteredLogs" :key="idx" class="hover:bg-panel">
                <td class="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {{ new Date(log.timestamp).toLocaleTimeString() }}
                </td>
                <td class="px-4 py-3">
                  <span class="ui-badge" :class="levelBadgeClass(log.level)">
                    {{ log.level }}
                  </span>
                </td>
                <td class="px-4 py-3 text-muted-foreground">
                  {{ log.component ?? '-' }}
                </td>
                <td class="px-4 py-3 text-muted-foreground">
                  {{ log.namespace ?? '-' }}
                </td>
                <td class="px-4 py-3">{{ log.msg }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="p-4 text-sm text-muted-foreground">No logs loaded.</p>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.admin-select option {
  background-color: var(--color-panel);
  color: var(--color-foreground);
}

.admin-auto-refresh-active.ui-btn-secondary {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: white;
  box-shadow: 0 0 14px rgba(249, 115, 22, 0.22);
}

.admin-auto-refresh-active.ui-btn-secondary:hover:not(:disabled) {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: white;
}

.admin-party-card {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 0.35rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-card);
  padding: 0.9rem;
  text-align: left;
  transition:
    border-color 180ms ease,
    background 180ms ease,
    transform 180ms ease;
}

.admin-party-card:hover,
.admin-party-card-active {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 10%, var(--color-card));
  transform: translateY(-1px);
}

.admin-party-card + .admin-party-card {
  margin-top: 0.75rem;
}

.admin-member-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-card);
  padding: 0.9rem;
}

.admin-party-meta {
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-card);
  padding: 1rem;
}
</style>
