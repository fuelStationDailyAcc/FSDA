const origin = (
  import.meta.env.DEV
    ? import.meta.env.VITE_BACKEND_URL
    : import.meta.env.VITE_PRODUCTION_BACKEND_URL || import.meta.env.VITE_BACKEND_URL
).replace(/\/$/, "")

export const API_ORIGIN = origin
export const API_BASE = `${origin}/api/v1`
export const USERS_API = `${API_BASE}/users`
export const ACCOUNTS_API = `${API_BASE}/accounts`
