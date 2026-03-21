<script setup lang="ts">
import { ref } from 'vue';

withDefaults(
  defineProps<{
    serverError?: string;
  }>(),
  {
    serverError: '',
  }
);

const emit = defineEmits<{
  create: [name: string];
  join: [name: string, code: string];
}>();

const name = ref('');
const roomCode = ref('');
const mode = ref<'menu' | 'create' | 'join'>('menu');
const error = ref('');

function clearError() {
  error.value = '';
}

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
    <div class="logo-container">
      <div class="logo-icon">🕵️</div>
      <h1 class="title">IMPOSTER</h1>
      <p class="subtitle">Social Deduction Word Game</p>
    </div>

    <div v-if="mode === 'menu'" class="menu">
      <input
        v-model="name"
        type="text"
        placeholder="Your name"
        maxlength="20"
        class="input"
        @input="clearError"
        @keyup.enter="mode = 'create'"
      />
      <button id="btn-create-room" class="btn btn-primary" @click="mode = 'create'">
        <span class="btn-icon">🏠</span> Create Room
      </button>
      <button id="btn-join-room" class="btn btn-secondary" @click="mode = 'join'">
        <span class="btn-icon">🚪</span> Join Room
      </button>
    </div>

    <div v-else-if="mode === 'create'" class="menu">
      <input
        v-model="name"
        type="text"
        placeholder="Your name"
        maxlength="20"
        class="input"
        @input="clearError"
        @keyup.enter="handleCreate"
      />
      <button id="btn-create-confirm" class="btn btn-primary" @click="handleCreate">
        Create Room
      </button>
      <button class="btn btn-back" @click="mode = 'menu'">← Back</button>
    </div>

    <div v-else class="menu">
      <input
        v-model="name"
        type="text"
        placeholder="Your name"
        maxlength="20"
        class="input"
        @input="clearError"
      />
      <input
        v-model="roomCode"
        type="text"
        placeholder="Room code"
        maxlength="4"
        class="input input-code"
        @input="clearError"
        @keyup.enter="handleJoin"
      />
      <button id="btn-join-confirm" class="btn btn-primary" @click="handleJoin">Join Room</button>
      <button class="btn btn-back" @click="mode = 'menu'">← Back</button>
    </div>

    <p v-if="error || serverError" class="error">
      {{ error || serverError }}
    </p>

    <div class="how-to-play">
      <details>
        <summary class="how-to-play-toggle">How to Play</summary>
        <div class="how-to-play-content">
          <p>
            <strong>🎯 Goal:</strong> Find the Imposter — the player who doesn't know the secret
            word!
          </p>
          <p>
            <strong>📝 Describe:</strong> Give a short clue that proves you know the word — but
            don't make it too obvious.
          </p>
          <p><strong>🗳️ Vote:</strong> Discuss and vote on who you think the Imposter is.</p>
          <p>
            <strong>🏁 Match:</strong> Keep playing rounds until someone reaches the target score
            set in the lobby.
          </p>
          <p>
            <strong>🕵️ Imposter:</strong> If caught, you get one chance to guess the word and steal
            the win!
          </p>
        </div>
      </details>
    </div>
  </div>
</template>

<style scoped>
.landing {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  gap: 1.5rem;
  padding: 2rem 1rem;
  background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
}

.logo-container {
  text-align: center;
  margin-bottom: 1rem;
}

.logo-icon {
  font-size: 4rem;
  margin-bottom: 0.5rem;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.title {
  font-size: 3.5rem;
  font-weight: 900;
  letter-spacing: 0.2em;
  background: linear-gradient(135deg, #f97316, #ef4444, #ec4899);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  color: #94a3b8;
  font-size: 1rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-top: 0.25rem;
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 300px;
}

.input {
  padding: 0.85rem 1rem;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 1rem;
  outline: none;
  transition: all 0.3s;
  backdrop-filter: blur(10px);
}

.input:focus {
  border-color: #f97316;
  box-shadow: 0 0 20px rgba(249, 115, 22, 0.15);
}

.input-code {
  text-transform: uppercase;
  text-align: center;
  letter-spacing: 0.4em;
  font-size: 1.3rem;
  font-weight: 700;
}

.btn {
  padding: 0.85rem 1.5rem;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-icon {
  font-size: 1.1rem;
}

.btn-primary {
  background: linear-gradient(135deg, #f97316, #ef4444);
  color: #fff;
  box-shadow: 0 4px 15px rgba(249, 115, 22, 0.3);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 25px rgba(249, 115, 22, 0.4);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
  border: 2px solid rgba(255, 255, 255, 0.15);
}

.btn-secondary:hover {
  border-color: #f97316;
  background: rgba(249, 115, 22, 0.1);
}

.btn-back {
  background: transparent;
  color: #64748b;
  font-size: 0.9rem;
}

.btn-back:hover {
  color: #e2e8f0;
}

.error {
  color: #ef4444;
  font-size: 0.875rem;
  padding: 0.5rem 1rem;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.how-to-play {
  width: 300px;
  margin-top: 1rem;
}

.how-to-play-toggle {
  color: #64748b;
  cursor: pointer;
  font-size: 0.9rem;
  text-align: center;
  transition: color 0.2s;
  list-style: none;
  padding: 0.5rem;
}

.how-to-play-toggle:hover {
  color: #94a3b8;
}

.how-to-play-toggle::-webkit-details-marker {
  display: none;
}

.how-to-play-content {
  margin-top: 0.75rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.how-to-play-content p {
  color: #94a3b8;
  font-size: 0.85rem;
  margin-bottom: 0.6rem;
  line-height: 1.5;
}

.how-to-play-content p:last-child {
  margin-bottom: 0;
}

.how-to-play-content strong {
  color: #e2e8f0;
}
</style>
