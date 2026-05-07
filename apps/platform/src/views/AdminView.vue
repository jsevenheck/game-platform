<script setup lang="ts">
import { ref } from 'vue';

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

async function fetchLogs(): Promise<void> {
  actionMessage.value = '';
  loadingLogs.value = true;
  try {
    const res = await fetch('/api/admin/logs?limit=300', {
      headers: { Authorization: `Bearer ${token.value}` },
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      actionMessage.value = json.error ?? 'Failed to load logs';
      return;
    }
    logs.value = json.logs;
  } catch {
    actionMessage.value = 'Request failed while loading logs';
  } finally {
    loadingLogs.value = false;
  }
}

async function cleanupAll(): Promise<void> {
  actionMessage.value = '';
  if (!confirm('Delete ALL parties, sessions, and connected player mappings?')) return;
  const res = await fetch('/api/admin/cleanup', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token.value}` },
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    actionMessage.value = json.error ?? 'Cleanup failed';
    return;
  }

  actionMessage.value = `Cleanup complete. Removed ${json.partiesRemoved} parties and ${json.membersRemoved} members.`;
  await fetchLogs();
}
</script>

<template>
  <main class="mx-auto flex max-w-6xl flex-col gap-4 p-6">
    <header class="ui-panel p-5">
      <h1 class="text-xl font-semibold">Admin Console</h1>
      <p class="text-sm text-muted-foreground">Secure endpoint for server logs and emergency party cleanup.</p>
    </header>

    <section class="ui-panel flex flex-wrap items-end gap-3 p-5">
      <label class="flex min-w-80 flex-1 flex-col gap-2 text-sm">
        Admin Bearer Token
        <input v-model="token" type="password" class="ui-input" placeholder="ADMIN_TOKEN" />
      </label>
      <button class="ui-btn-secondary" :disabled="loadingLogs || !token" @click="fetchLogs">Refresh Logs</button>
      <button class="ui-btn-danger" :disabled="!token" @click="cleanupAll">Delete All Parties</button>
    </section>

    <p v-if="actionMessage" class="ui-panel p-3 text-sm">{{ actionMessage }}</p>

    <section class="ui-panel p-0">
      <div class="border-b border-border px-4 py-3 text-sm font-medium">Recent Logs</div>
      <div class="max-h-[65vh] overflow-auto p-2">
        <pre v-if="logs.length" class="text-xs leading-5">{{ logs }}</pre>
        <p v-else class="p-3 text-sm text-muted-foreground">No logs loaded.</p>
      </div>
    </section>
  </main>
</template>
