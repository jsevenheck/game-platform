<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{
  create: [name: string];
  join: [name: string, code: string];
}>();

defineProps<{
  serverError?: string;
}>();

const name = ref('');
const roomCode = ref('');
const mode = ref<'menu' | 'create' | 'join'>('menu');
const error = ref('');

function handleCreate() {
  if (!name.value.trim()) {
    error.value = 'Enter your name';
    return;
  }
  emit('create', name.value.trim());
}

function handleJoin() {
  if (!name.value.trim()) {
    error.value = 'Enter your name';
    return;
  }
  if (!roomCode.value.trim()) {
    error.value = 'Enter room code';
    return;
  }
  emit('join', name.value.trim(), roomCode.value.trim().toUpperCase());
}
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-[80vh] gap-4">
    <h1 class="text-5xl font-black tracking-[0.2em] text-foreground">Secret Signals</h1>

    <div v-if="mode === 'menu'" class="flex flex-col gap-3 w-[280px]">
      <input
        v-model="name"
        type="text"
        placeholder="Your name"
        maxlength="20"
        class="ui-input !bg-white/5 !border-white/10 focus:!border-signals"
        @keyup.enter="mode = 'create'"
      />
      <button class="ui-btn-primary !bg-signals hover:!bg-signals-hover" @click="mode = 'create'">Create Room</button>
      <button class="ui-btn-secondary hover:!border-signals hover:!text-signals" @click="mode = 'join'">Join Room</button>
    </div>

    <div v-else-if="mode === 'create'" class="flex flex-col gap-3 w-[280px]">
      <input
        v-model="name"
        type="text"
        placeholder="Your name"
        maxlength="20"
        class="ui-input !bg-white/5 !border-white/10 focus:!border-signals"
        @keyup.enter="handleCreate"
      />
      <button class="ui-btn-primary !bg-signals hover:!bg-signals-hover" @click="handleCreate">Create Room</button>
      <button class="ui-btn-ghost !text-muted-foreground hover:!text-foreground" @click="mode = 'menu'">Back</button>
    </div>

    <div v-else class="flex flex-col gap-3 w-[280px]">
      <input v-model="name" type="text" placeholder="Your name" maxlength="20" class="ui-input !bg-white/5 !border-white/10 focus:!border-signals" />
      <input
        v-model="roomCode"
        type="text"
        placeholder="Room code"
        maxlength="4"
        class="ui-input !bg-white/5 !border-white/10 focus:!border-signals uppercase text-center tracking-[0.3em] !text-xl"
        @keyup.enter="handleJoin"
      />
      <button class="ui-btn-primary !bg-signals hover:!bg-signals-hover" @click="handleJoin">Join Room</button>
      <button class="ui-btn-ghost !text-muted-foreground hover:!text-foreground" @click="mode = 'menu'">Back</button>
    </div>

    <p v-if="serverError || error" class="text-danger text-sm">
      {{ serverError || error }}
    </p>
  </div>
</template>
