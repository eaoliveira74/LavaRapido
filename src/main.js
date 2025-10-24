import { createApp } from 'vue';
import { createPinia } from 'pinia';
import 'bootstrap/dist/css/bootstrap.min.css';
import * as bootstrapModule from 'bootstrap/dist/js/bootstrap.bundle.min.js';
import App from './App.vue';
import './assets/main.css';

// Garante que o código legado encontre o namespace do Bootstrap exposto globalmente.
if (typeof window !== 'undefined') {
	const bootstrap = bootstrapModule?.default || bootstrapModule;
	window.bootstrap = bootstrap;
}

const app = createApp(App);
app.use(createPinia());
app.mount('#app');
