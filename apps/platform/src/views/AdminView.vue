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

const token = ref('');
const logs = ref<AdminLog[]>([]);
const loadingLogs = ref(false);
const actionMessage = ref('');
const errorMessage = ref('');

const levelFilter = ref('');
const componentFilter = ref('');
const searchQuery = ref('');
const autoRefresh = ref(false);

let refreshInterval: ReturnType<typeof setInterval> | null = null;
const STORAGE_KEY = 'admin_token';

onMounted(() => {
  token.value = localStorage.getItem(STORAGE_KEY) ?? '';
});

watch(token, (val) => {
  if (val) localStorage.setItem(STORAGE_KEY, val);
  else localStorage.removeItem(STORAGE_KEY);
});

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
      headers: { Authorization: `Bearer ${token.value}` },
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      errorMessage.value = json.error ?? 'Failed to load logs';
      return;
    }
    logs.value = json.logs;
  } catch {
    errorMessage.value = 'Request failed while loading logs';
  } finally {
    loadingLogs.value = false;
  }
}

async function cleanupAll(): Promise<void> {
  errorMessage.value = '';
  actionMessage.value = '';
  if (!confirm('Delete ALL parties and disconnect every connected player?')) return;

  const res = await fetch('/api/admin/cleanup', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token.value}` },
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    errorMessage.value = json.error ?? 'Cleanup failed';
    return;
  }

  actionMessage.value = `Cleanup complete. Removed ${json.partiesRemoved} parties and ${json.membersRemoved} members.`;
  await fetchLogs();
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
      return 'bg-danger! text-white!';
    case 'warn':
      return 'bg-warning! text-black!';
    case 'info':
      return 'bg-success! text-white!';
    default:
      return 'bg-muted text-muted-foreground';
  }
}
</script>

<template>
  <main class="mx-auto flex max-w-7xl flex-col gap-4 p-6">
    <header class="ui-panel p-5">
      <h1 class="text-xl font-semibold">Admin Console</h1>
      <p class="text-sm text-muted-foreground">
        Secure endpoint for server logs and emergency party cleanup.
      </p>
    </header>

    <section class="ui-panel flex flex-wrap items-end gap-3 p-5">
      <label class="flex min-w-80 flex-1 flex-col gap-2 text-sm">
        Admin Bearer Token
        <input v-model="token" type="password" class="ui-input" placeholder="ADMIN_TOKEN" />
      </label>
      <button class="ui-btn-secondary" :disabled="loadingLogs || !token" @click="fetchLogs">
        {{ loadingLogs ? 'Loading…' : 'Refresh Logs' }}
      </button>
      <button
        class="ui-btn-secondary"
        :class="{ 'bg-accent! text-white!': autoRefresh }"
        :disabled="!token"
        @click="toggleAutoRefresh"
      >
        {{ autoRefresh ? 'Stop Auto-Refresh' : 'Auto-Refresh (5s)' }}
      </button>
      <button class="ui-btn-danger" :disabled="!token" @click="cleanupAll">
        Delete All Parties
      </button>
    </section>

    <section class="ui-panel flex flex-wrap gap-3 p-4">
      <label class="flex flex-col gap-1 text-xs">
        Level
        <select v-model="levelFilter" class="ui-input text-sm" @change="fetchLogs">
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

    <section class="ui-panel p-0">
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
              <th class="px-3 py-2 font-medium">Time</th>
              <th class="px-3 py-2 font-medium">Level</th>
              <th class="px-3 py-2 font-medium">Component</th>
              <th class="px-3 py-2 font-medium">Namespace</th>
              <th class="px-3 py-2 font-medium">Message</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="(log, idx) in filteredLogs" :key="idx" class="hover:bg-panel">
              <td class="px-3 py-2 whitespace-nowrap text-muted-foreground">
                {{ new Date(log.timestamp).toLocaleTimeString() }}
              </td>
              <td class="px-3 py-2">
                <span class="ui-badge" :class="levelBadgeClass(log.level)">
                  {{ log.level }}
                </span>
              </td>
              <td class="px-3 py-2 text-muted-foreground">
                {{ log.component ?? '-' }}
              </td>
              <td class="px-3 py-2 text-muted-foreground">
                {{ log.namespace ?? '-' }}
              </td>
              <td class="px-3 py-2">{{ log.msg }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="p-4 text-sm text-muted-foreground">No logs loaded.</p>
      </div>
    </section>
  </main>
</template>
