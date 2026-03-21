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
  <div class="landing">
    <h1 class="title">
      BLACKOUT
    </h1>
    <p class="subtitle">
      The fast-thinking party game
    </p>

    <div
      v-if="mode === 'menu'"
      class="menu"
    >
      <input
        v-model="name"
        type="text"
        placeholder="Your name"
        maxlength="20"
        class="input"
        @keyup.enter="mode = 'create'"
      >
      <button
        class="btn btn-primary"
        @click="mode = 'create'"
      >
        Create Room
      </button>
      <button
        class="btn btn-secondary"
        @click="mode = 'join'"
      >
        Join Room
      </button>
    </div>

    <div
      v-else-if="mode === 'create'"
      class="menu"
    >
      <input
        v-model="name"
        type="text"
        placeholder="Your name"
        maxlength="20"
        class="input"
        @keyup.enter="handleCreate"
      >
      <button
        class="btn btn-primary"
        @click="handleCreate"
      >
        Create Room
      </button>
      <button
        class="btn btn-back"
        @click="mode = 'menu'"
      >
        Back
      </button>
    </div>

    <div
      v-else
      class="menu"
    >
      <input
        v-model="name"
        type="text"
        placeholder="Your name"
        maxlength="20"
        class="input"
      >
      <input
        v-model="roomCode"
        type="text"
        placeholder="Room code"
        maxlength="4"
        class="input input-code"
        @keyup.enter="handleJoin"
      >
      <button
        class="btn btn-primary"
        @click="handleJoin"
      >
        Join Room
      </button>
      <button
        class="btn btn-back"
        @click="mode = 'menu'"
      >
        Back
      </button>
    </div>

    <p
      v-if="error"
      class="error"
    >
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.landing {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  gap: 1rem;
}

.title {
  font-size: 3rem;
  font-weight: 900;
  letter-spacing: 0.3em;
  color: #fff;
  text-shadow: 0 0 40px rgba(139, 92, 246, 0.5);
}

.subtitle {
  color: #a1a1aa;
  margin-bottom: 2rem;
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 280px;
}

.input {
  padding: 0.75rem 1rem;
  border: 2px solid #3f3f46;
  border-radius: 8px;
  background: #18181b;
  color: #fff;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;
}

.input:focus {
  border-color: #8b5cf6;
}

.input-code {
  text-transform: uppercase;
  text-align: center;
  letter-spacing: 0.3em;
  font-size: 1.25rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #8b5cf6;
  color: #fff;
}

.btn-primary:hover {
  background: #7c3aed;
}

.btn-secondary {
  background: #27272a;
  color: #d4d4d8;
  border: 2px solid #3f3f46;
}

.btn-secondary:hover {
  border-color: #8b5cf6;
}

.btn-back {
  background: transparent;
  color: #71717a;
}

.btn-back:hover {
  color: #d4d4d8;
}

.error {
  color: #ef4444;
  font-size: 0.875rem;
}
</style>
