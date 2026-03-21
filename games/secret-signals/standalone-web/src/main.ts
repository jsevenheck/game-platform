// Standalone-web entry point — identical to ui-vue/src/main.ts.
// Uses the `@` alias (configured in vite.config.ts) to reference ui-vue source.
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from '@/App.vue';

const app = createApp(App);
app.use(createPinia());
app.mount('#app');
