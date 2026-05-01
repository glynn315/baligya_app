import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Reusable branded header used across auth screens.
 * Shows the Baligya logo (or tenant logo) on a soft brand surface.
 */
@Component({
  selector: 'app-brand-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="brand-header" [class.compact]="compact">
      <div class="logo-wrap">
        <img [src]="logoUrl || 'assets/baligyalogo.png'" alt="Baligya" />
      </div>
      <h1 *ngIf="title" class="title">{{ title }}</h1>
      <p *ngIf="subtitle" class="subtitle">{{ subtitle }}</p>
    </div>
  `,
  styles: [`
    .brand-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 32px 20px 20px;
    }
    .brand-header.compact { padding: 18px 20px 10px; }
    .logo-wrap {
      width: 100%;
      max-width: 240px;
      display: flex;
      justify-content: center;
      margin-bottom: 18px;
      img { width: 100%; height: auto; }
    }
    .brand-header.compact .logo-wrap {
      max-width: 140px;
      margin-bottom: 8px;
    }
    .title {
      font-size: 22px;
      font-weight: 700;
      color: var(--ion-text-color);
      margin: 0 0 6px;
    }
    .subtitle {
      font-size: 14px;
      color: var(--ion-color-medium);
      margin: 0;
      max-width: 320px;
    }
  `],
})
export class BrandHeaderComponent {
  @Input() title?: string;
  @Input() subtitle?: string;
  @Input() logoUrl?: string | null;
  @Input() compact = false;
}
