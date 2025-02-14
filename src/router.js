"use strict";

import { createRouter, createWebHashHistory } from 'vue-router';

import Shopping from './components/shopping_card.vue';
import Tracking from './components/order_tracking.vue';
import Payement from './components/web_payement.vue';
import Settings from './components/profil.vue';

const routes = [
    { path: '/shopping_card', name: 'Shopping', component: Shopping },
    { path: '/order_tracking', name: 'Tracking', component: Tracking },
    { path: '/web_payement', name: 'Payement', component: Payement },
    { path: '/profil', name: 'Settings', component: Settings }
];

const router = createRouter({
    history: createWebHashHistory(),
    routes
});

export default router;
