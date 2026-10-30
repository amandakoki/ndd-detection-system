import { getSession } from "./auth";

export const API_ROOT = "http://127.0.0.1:8000/api";
export const API = `${API_ROOT}/auth`;

// fetch() to an API path with the logged-in user's token attached
export function authFetch(path, options = {}) {
  const session = getSession();
  return fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      Authorization: `Bearer ${session?.access}`,
    },
  });
}