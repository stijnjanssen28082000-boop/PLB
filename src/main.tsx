import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { defineCustomElements as defineSqliteElements } from 'jeep-sqlite/loader';
import { App } from './app/App';
import { initI18n } from './i18n';
import './styles/global.css';

// jeep-sqlite backs the SQLite plugin in the browser, so the same data layer
// runs during `npm run dev` as on the device.
void defineSqliteElements(window);

void initI18n().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
