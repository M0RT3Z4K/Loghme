import React from 'react';
import ReactDOM from 'react-dom/client';
import '@chatui/core/dist/index.css';
import './assets/chat-theme.css';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

reportWebVitals();
