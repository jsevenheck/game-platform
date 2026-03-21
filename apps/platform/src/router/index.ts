import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import PartyView from '../views/PartyView.vue';
import GameView from '../views/GameView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/party/:inviteCode',
      name: 'party',
      component: PartyView,
      props: true,
    },
    {
      path: '/party/:inviteCode/game/:gameId',
      name: 'game',
      component: GameView,
      props: true,
    },
  ],
});

export default router;
