"use strict";

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import VueTelInput from 'vue-tel-input';
import 'vue-tel-input/vue-tel-input.css'

import './style.scss';
import App from './App.vue';
import router from './router';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(VueTelInput);

app.mount('#app');
