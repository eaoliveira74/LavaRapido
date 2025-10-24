import { defineStore } from 'pinia';

const ADMIN_TOKEN_KEY = 'adminToken';

function readStoredToken() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch (err) {
    console.warn('Unable to read admin token from localStorage', err);
    return null;
  }
}

function persistToken(token) {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  } catch (err) {
    console.warn('Unable to persist admin token in localStorage', err);
  }
}

export const useAppStore = defineStore('app', {
  state: () => ({
    role: 'selection',
    adminToken: readStoredToken(),
    appReady: false,
  }),
  actions: {
    setRole(role) {
      this.role = role || 'selection';
    },
    setAdminToken(token) {
      this.adminToken = token || null;
      persistToken(this.adminToken);
    },
    setAppReady(ready) {
      this.appReady = !!ready;
    },
  },
});
