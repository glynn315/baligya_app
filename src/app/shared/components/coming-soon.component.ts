import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { sparklesOutline, timeOutline } from 'ionicons/icons';

/**
 * Reusable "Coming soon" page wrapper.
 * Lets us ship route stubs (Subscription, Security/PIN, Store profile)
 * without dead links while the API endpoints aren't yet wired.
 */
@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonIcon,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button [defaultHref]="backHref"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ title }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <div class="coming-shell">
        <div class="icon-wrap">
          <ion-icon [name]="iconName"></ion-icon>
        </div>
        <h2>{{ heading }}</h2>
        <p>{{ blurb }}</p>
        <div class="badge">
          <ion-icon name="time-outline"></ion-icon>
          Coming soon
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .coming-shell {
      min-height: 100%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 12px;
      padding: 32px 24px;
      text-align: center;
    }
    .icon-wrap {
      width: 96px; height: 96px;
      border-radius: 28px;
      background: var(--baligya-50);
      color: var(--baligya-700);
      display: flex; align-items: center; justify-content: center;
      ion-icon { font-size: 52px; }
    }
    h2 { margin: 4px 0 0; font-size: 22px; font-weight: 800; }
    p { margin: 0; max-width: 320px; color: var(--ion-color-medium); }
    .badge {
      margin-top: 8px;
      display: inline-flex; align-items: center; gap: 6px;
      background: var(--ion-color-light);
      color: var(--ion-color-medium);
      padding: 8px 14px;
      border-radius: 999px;
      font-weight: 700; font-size: 13px;
      ion-icon { font-size: 16px; }
    }
  `],
})
export class ComingSoonComponent {
  @Input() title = 'Coming soon';
  @Input() heading = 'This feature is on the way';
  @Input() blurb = 'We\'re still building this. Check back soon — your store data is safe in the meantime.';
  @Input() iconName = 'sparkles-outline';
  @Input() backHref = '/tabs/more';

  constructor() { addIcons({ sparklesOutline, timeOutline }); }
}
