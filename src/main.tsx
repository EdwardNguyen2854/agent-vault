import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import Excalidraw CSS
import '@excalidraw/excalidraw/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
