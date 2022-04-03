import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { KiroboProvider } from "@kiroboio/web3-react-safe-transfer"

ReactDOM.render(
  <React.StrictMode>
    <KiroboProvider>
      <App />
    </KiroboProvider>
  </React.StrictMode>,
  document.getElementById('root')
);

reportWebVitals();
