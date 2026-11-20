// Single base URL for every API call the frontend makes.
// All requests go to the Node backend, which handles auth and forwards
// forecast/geo requests to the Python service.
//
// - Local dev: Vite proxies `/api` to http://localhost:5000 (see vite.config.js)
// - Docker:    the nginx proxy routes `/api` to the Node backend
// - Render:    the static site rewrites `/api/*` to the Node backend
//
// Set VITE_API_BASE_URL only if the backend lives on another origin.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
