<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{
  create: [name: string];
  join: [name: string, code: string];
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
  <div class="flex min-h-[80vh] flex-col items-center justify-center gap-4">
    <h1
      class="text-5xl font-black tracking-[0.3em] text-foreground"
      style="text-shadow: 0 0 40px rgba(139, 92, 246, 0.4)"
    >
      BLACKOUT
    </h1>
    <p class="mb-8 text-muted">The fast-thinking party game</p>

    <div v-if="mode === 'menu'" class="flex w-[280px] flex-col gap-3">
      <input
        v-model="name"
        class="ui-input"
        type="text"
        placeholder="Your name"
        maxlength="20"
        @keyup.enter="mode = 'create'"
      />
      <button class="ui-btn-primary !bg-blackout hover:!bg-blackout-hover" @click="mode = 'create'">
        Create Room
      </button>
      <button
        class="ui-btn-secondary hover:!border-blackout hover:!text-blackout"
        @click="mode = 'join'"
      >
        Join Room
      </button>
    </div>

    <div v-else-if="mode === 'create'" class="flex w-[280px] flex-col gap-3">
      <input
        v-model="name"
        class="ui-input focus:!border-blackout"
        type="text"
        placeholder="Your name"
        maxlength="20"
        @keyup.enter="handleCreate"
      />
      <button class="ui-btn-primary !bg-blackout hover:!bg-blackout-hover" @click="handleCreate">
        Create Room
      </button>
      <button class="ui-btn-ghost" @click="mode = 'menu'">Back</button>
    </div>

    <div v-else class="flex w-[280px] flex-col gap-3">
      <input
        v-model="name"
        class="ui-input focus:!border-blackout"
        type="text"
        placeholder="Your name"
        maxlength="20"
      />
      <input
        v-model="roomCode"
        class="ui-input text-center text-xl uppercase tracking-[0.3em] focus:!border-blackout"
        type="text"
        placeholder="Room code"
        maxlength="4"
        @keyup.enter="handleJoin"
      />
      <button class="ui-btn-primary !bg-blackout hover:!bg-blackout-hover" @click="handleJoin">
        Join Room
      </button>
      <button class="ui-btn-ghost" @click="mode = 'menu'">Back</button>
    </div>

    <p v-if="error" class="text-sm text-danger">{{ error }}</p>
  </div>
</template>
