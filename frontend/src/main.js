import { createApp } from 'vue';
import { createI18n } from 'vue-i18n';
import PrimeVue from 'primevue/config';
import ConfirmationService from 'primevue/confirmationservice';
import Tooltip from 'primevue/tooltip';
import ToastService from 'primevue/toastservice';

import App from './App.vue';
import messages from '@intlify/unplugin-vue-i18n/messages';
import router from './router';
import emitter from './services/emitter.service';

const i18n = createI18n({
  legacy: false,
  locale: 'ru',
  fallbackLocale: 'en',
  globalInjection: true,
});

const app = createApp({
  ...App,
  strict: false,
})
  .use(router)
  .use(PrimeVue)
  .use(ConfirmationService)
  .use(ToastService)
  .use(i18n)
  .directive('tooltip', Tooltip);

app.config.globalProperties.emitter = emitter;

app.mount('#app');
