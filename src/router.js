"use strict";

import { createRouter, createWebHashHistory } from 'vue-router';

import Shopping from '@/components/shopping_cart.vue';
import Tracking from '@/components/order_tracking.vue';
import Payment from '@/components/web_payment.vue';
import Settings from '@/components/profile.vue';

const routes = [
    { path: '/shopping_cart', component: Shopping },
    { path: '/order_tracking', component: Tracking },
    { path: '/web_payment', component: Payment },
    { path: '/profile', component: Settings }
];

const router = createRouter({
    history: createWebHashHistory(),
    routes
});

export default router;
