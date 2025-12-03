import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

// Check if we have pre-rendered content to hydrate
if (rootElement.hasChildNodes()) {
  // Hydrate existing pre-rendered content
  hydrateRoot(rootElement, <App />);
} else {
  // Fresh render (for dev mode or when no content was pre-rendered)
  createRoot(rootElement).render(<App />);
}
