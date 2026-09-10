import axios from 'axios'

if (!import.meta.env.VITE_API_URL || typeof import.meta.env.VITE_API_URL !== 'string') {
  throw new Error('VITE_API_URL is not set')
}

export const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  // Without this axios waits forever, which is how a stuck backend turned into a spinner that
  // never resolved. Kept above the backend's own 60s batch deadline so the server normally
  // answers first: this is the safety net, not the mechanism.
  timeout: 90_000,
  headers: {
    'Content-Type': 'application/json',
  },
})
