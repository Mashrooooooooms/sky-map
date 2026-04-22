import './assets/main.css'

import { createApp } from 'vue';
import App from './App.vue';
import VueApexCharts from 'vue3-apexcharts';

const app = createApp(App);
app.component('apexchart', VueApexCharts);   // глобальная регистрация
app.mount('#app');