import { createApp, h } from 'vue';
import { createPinia } from 'pinia';
import GameComponent from './App.vue';

const params = new URLSearchParams(window.location.search);

const app = createApp({
  render() {
    return h(GameComponent, {
      sessionId: params.get('sessionId') || 'embedded-session',
      playerId: params.get('playerId') || 'embedded-player',
      playerName: params.get('playerName') || 'Embedded Player',
      joinToken: params.get('joinToken') || 'embedded-token',
      wsNamespace: params.get('wsNamespace') || '/g/blackout',
      apiBaseUrl: params.get('apiBaseUrl') || undefined,
    });
  },
});

app.use(createPinia());
app.mount('#app');
