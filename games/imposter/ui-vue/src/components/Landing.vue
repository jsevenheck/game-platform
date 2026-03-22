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
  <div class="flex flex-col items-center justify-center min-h-dvh gap-6 px-4 py-8 bg-gradient-to-br from-imposter-gradient-1 via-imposter-gradient-2 to-imposter-gradient-3">
    <div class="text-center mb-4">
      <h1 class="text-[3.5rem] font-black tracking-[0.2em] bg-gradient-to-br from-imposter via-danger to-pink-500 bg-clip-text text-transparent">IMPOSTER</h1>
      <p class="text-muted uppercase text-sm tracking-[0.15em] mt-1">Social Deduction Word Game</p>
    </div>

    <div v-if="mode === 'menu'" class="flex flex-col gap-3 w-[300px]">
      <input
        v-model="name"
        type="text"
        placeholder="Your name"
        maxlength="20"
        class="ui-input !bg-white/5 !border-white/10 focus:!border-imposter"
        @input="clearError"
        @keyup.enter="mode = 'create'"
      />
      <button id="btn-create-room" class="ui-btn-primary !bg-imposter hover:!bg-imposter-hover" @click="mode = 'create'">
        Create Room
      </button>
      <button id="btn-join-room" class="ui-btn-secondary hover:!border-imposter hover:!text-imposter" @click="mode = 'join'">
        Join Room
      </button>
    </div>

    <div v-else-if="mode === 'create'" class="flex flex-col gap-3 w-[300px]">
      <input
        v-model="name"
        type="text"
        placeholder="Your name"
        maxlength="20"
        class="ui-input !bg-white/5 !border-white/10 focus:!border-imposter"
        @input="clearError"
        @keyup.enter="handleCreate"
      />
      <button id="btn-create-confirm" class="ui-btn-primary !bg-imposter hover:!bg-imposter-hover" @click="handleCreate">
        Create Room
      </button>
      <button class="ui-btn-ghost !text-muted-foreground hover:!text-foreground !text-sm" @click="mode = 'menu'">â† Back</button>
    </div>

    <div v-else class="flex flex-col gap-3 w-[300px]">
      <input
        v-model="name"
        type="text"
        placeholder="Your name"
        maxlength="20"
        class="ui-input !bg-white/5 !border-white/10 focus:!border-imposter"
        @input="clearError"
      />
      <input
        v-model="roomCode"
        type="text"
        placeholder="Room code"
        maxlength="4"
        class="ui-input !bg-white/5 !border-white/10 focus:!border-imposter uppercase text-center tracking-[0.4em] text-xl font-bold"
        @input="clearError"
        @keyup.enter="handleJoin"
      />
      <button id="btn-join-confirm" class="ui-btn-primary !bg-imposter hover:!bg-imposter-hover" @click="handleJoin">Join Room</button>
      <button class="ui-btn-ghost !text-muted-foreground hover:!text-foreground !text-sm" @click="mode = 'menu'">â† Back</button>
    </div>

    <p v-if="error || serverError" class="text-danger text-sm px-4 py-2 bg-danger-muted rounded-lg border border-danger/20">
      {{ error || serverError }}
    </p>

    <div class="w-[300px] mt-4">
      <details>
        <summary class="text-muted-foreground cursor-pointer text-sm text-center list-none py-2 hover:text-muted">How to Play</summary>
        <div class="mt-3 p-4 bg-white/5 rounded-[--radius-lg] border border-white/[0.08]">
          <p class="text-muted text-sm mb-2.5 leading-relaxed"><strong class="text-foreground">Goal:</strong> Find the Imposter â€” the player who doesn't know the secret word!</p>
          <p class="text-muted text-sm mb-2.5 leading-relaxed"><strong class="text-foreground">Describe:</strong> Give a short clue that proves you know the word â€” but don't make it too obvious.</p>
          <p class="text-muted text-sm mb-2.5 leading-relaxed"><strong class="text-foreground">Vote:</strong> Discuss and vote on who you think the Imposter is.</p>
          <p class="text-muted text-sm mb-2.5 leading-relaxed"><strong class="text-foreground">Match:</strong> Keep playing rounds until someone reaches the target score set in the lobby.</p>
          <p class="text-muted text-sm leading-relaxed"><strong class="text-foreground">Imposter:</strong> If caught, you get one chance to guess the word and steal the win!</p>
        </div>
      </details>
    </div>
  </div>
</template>
