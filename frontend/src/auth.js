const KEY = "auth";

export function saveSession(data) {
  localStorage.setItem(
    KEY,
    JSON.stringify({ access: data.access, refresh: data.refresh, user: data.user })
  );
}

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem(KEY);
}

// where each role will land after logging in
export const HOME = {
  educator: "/educator",
  learner: "/learner",
  parent: "/parent",
  admin: "/system-admin",
};