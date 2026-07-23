export type UserRole = "doctor" | "patient";

const ROLE_STORAGE_KEY = "lumina_user_role";

function getLocalStorage() {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredUserRole(defaultRole: UserRole = "doctor"): UserRole {
  const storage = getLocalStorage();
  if (!storage) return defaultRole;

  try {
    return storage.getItem(ROLE_STORAGE_KEY) === "patient" ? "patient" : defaultRole;
  } catch {
    return defaultRole;
  }
}

export function writeStoredUserRole(role: UserRole) {
  const storage = getLocalStorage();
  if (!storage) return;

  try {
    storage.setItem(ROLE_STORAGE_KEY, role);
  } catch {
    // Storage can be unavailable in private/embedded browser contexts.
  }
}
