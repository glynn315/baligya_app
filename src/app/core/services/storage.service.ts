import { Injectable } from '@angular/core';

/**
 * Thin wrapper over localStorage with JSON support.
 * Centralised so we can swap to Capacitor Preferences for native if needed.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  getString(key: string): string | null {
    return localStorage.getItem(key);
  }

  setString(key: string, value: string): void {
    localStorage.setItem(key, value);
  }

  remove(key: string): void {
    localStorage.removeItem(key);
  }

  clearAuth(keys: string[]): void {
    keys.forEach((k) => localStorage.removeItem(k));
  }
}
