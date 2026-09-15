import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { FirestoreSyncService } from './services/firestore-sync.service';

// Kick off Cloud Firestore synchronization immediately on boot
FirestoreSyncService.initialize().catch((err) => {
  console.warn('Initial Firestore sync warning:', err);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
