import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/geist/wght.css';
import '@fontsource/geist-mono/400.css';
import App from './App.jsx';
import { iniciarPagina } from './i18n.js';
import './styles.css';
import './case.css';

iniciarPagina();
createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
