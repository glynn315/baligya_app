import { Injectable, signal } from '@angular/core';
import { Network } from '@capacitor/network';

/**
 * Reactive online/offline signal backed by @capacitor/network. On web
 * we fall back to `navigator.onLine` + 'online'/'offline' events so the
 * dev server behaves sensibly.
 */
@Injectable({ providedIn: 'root' })
export class NetworkService {
  readonly online = signal<boolean>(true);
  private booted = false;

  async init(): Promise<void> {
    if (this.booted) return;
    this.booted = true;

    try {
      const status = await Network.getStatus();
      this.online.set(!!status.connected);
      Network.addListener('networkStatusChange', (s) => this.online.set(!!s.connected));
    } catch {
      // Web/standalone fallback.
      this.online.set(typeof navigator !== 'undefined' ? navigator.onLine : true);
      if (typeof window !== 'undefined') {
        window.addEventListener('online', () => this.online.set(true));
        window.addEventListener('offline', () => this.online.set(false));
      }
    }
  }
}
