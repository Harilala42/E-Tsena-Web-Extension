"use strict";

import { createRouter, createWebHashHistory } from 'vue-router';

import Shopping from '@/components/shopping_cart.vue';
import Tracking from '@/components/order_tracking.vue';
import Payement from '@/components/web_payement.vue';
import Settings from '@/components/profile.vue';

const routes = [
    { path: '/shopping_cart', component: Shopping },
    { path: '/order_tracking', component: Tracking },
    { path: '/web_payement', component: Payement },
    { path: '/profile', component: Settings }
];

const router = createRouter({
    history: createWebHashHistory(),
    routes
});

export default router;
