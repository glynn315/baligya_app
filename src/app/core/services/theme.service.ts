import { Injectable } from '@angular/core';
import { Tenant } from '../models/api.models';

/**
 * Applies tenant-specific brand colors at runtime by overriding
 * CSS variables on :root. Falls back to Baligya defaults when null.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly defaultPrimary = '#1FA64D';
  private readonly defaultSecondary = '#126B31';

  apply(tenant: Tenant | null): void {
    const root = document.documentElement;
    const primary = (tenant?.primary_color || this.defaultPrimary).trim();
    const secondary = (tenant?.secondary_color || this.defaultSecondary).trim();

    root.style.setProperty('--tenant-primary', primary);
    root.style.setProperty('--tenant-secondary', secondary);

    // Re-derive Ionic primary so all Ionic components reflect the tenant.
    root.style.setProperty('--ion-color-primary', primary);
    root.style.setProperty('--ion-color-primary-shade', this.shade(primary, -0.1));
    root.style.setProperty('--ion-color-primary-tint', this.shade(primary, 0.12));
    root.style.setProperty('--ion-color-primary-rgb', this.hexToRgb(primary));
    root.style.setProperty('--ion-tab-bar-color-selected', primary);
  }

  reset(): void { this.apply(null); }

  private hexToRgb(hex: string): string {
    const m = hex.replace('#', '');
    const v = m.length === 3
      ? m.split('').map((c) => c + c).join('')
      : m;
    const num = parseInt(v, 16);
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
  }

  private shade(hex: string, amount: number): string {
    const m = hex.replace('#', '');
    const v = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
    const num = parseInt(v, 16);
    let r = (num >> 16) & 255;
    let g = (num >> 8) & 255;
    let b = num & 255;
    const adj = (c: number) => Math.max(0, Math.min(255, Math.round(c + 255 * amount)));
    r = adj(r); g = adj(g); b = adj(b);
    return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  }
}
