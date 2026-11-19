import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { App } from './App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root is missing from index.html');
const root = createRoot(rootElement);

const render = () =>
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

/**
 * The built page loads the app stylesheet without blocking the first paint (see vite.config.ts),
 * so replace the static shell only once it has applied; otherwise the app would flash unstyled.
 */
const appStylesheet = document.querySelector<HTMLLinkElement>('link[data-app-css]');
if (appStylesheet && appStylesheet.media !== 'all') {
  const onSettled = () => {
    appStylesheet.media = 'all';
    render();
  };
  appStylesheet.addEventListener('load', onSettled, { once: true });
  appStylesheet.addEventListener('error', onSettled, { once: true });
} else {
  render();
}
