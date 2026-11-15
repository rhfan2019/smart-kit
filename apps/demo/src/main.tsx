import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@rhfan2019/smart-kit/styles.css';
import './demo.css';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
