import axios from 'axios';

// In production (Docker via Nginx), requests to /api/ will be proxied to the backend.
// In development, we rely on Vite's proxy.
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
