import { start } from './app.js';
import { registerSW, initInstall } from './pwa.js';

initInstall();
start(document.getElementById('app'));
registerSW();
