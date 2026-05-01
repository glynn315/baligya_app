import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { sparklesOutline, checkmarkCircle, timeOutline } from 'ionicons/icons';

import { AuthService } from '../../../core/services/auth.service';
import { PesoPipe } from '../../../shared/pipes/peso.pipe';

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [
    CommonModule, PesoPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonIcon,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/more"></ion-back-button>
        </ion-buttons>
        <ion-title>Subscription</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <div class="container-tight content-wrap">
        <div class="plan-card">
          <div class="plan-head">
            <ion-icon name="sparkles-outline"></ion-icon>
            <div>
              <p class="plan-label">Current plan</p>
              <h2 class="plan-name">{{ auth.tenant()?.subscription_plan?.name || 'Free trial' }}</h2>
            </div>
          </div>
          <p *ngIf="auth.tenant()?.subscription_plan?.price as price" class="plan-price">
            {{ price | peso }}<span class="per">/mo</span>
          </p>
          <ul *ngIf="auth.tenant()?.subscription_plan?.features as feats" class="plan-feats">
            <li *ngFor="let f of feats">
              <ion-icon name="checkmark-circle"></ion-icon> {{ f }}
            </li>
          </ul>
        </div>

        <div class="notice">
          <div class="badge">
            <ion-icon name="time-outline"></ion-icon>
            Plan management coming soon
          </div>
          <p>You'll be able to upgrade, change billing, and view invoices here. For now, contact support to change plans.</p>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .content-wrap { padding: 16px 0 32px; display: flex; flex-direction: column; gap: 16px; }
    .plan-card {
      background: linear-gradient(160deg, var(--baligya-500), var(--baligya-700));
      color: #fff;
      border-radius: 20px;
      padding: 18px;
      box-shadow: 0 12px 28px rgba(31,166,77,0.25);
    }
    .plan-head {
      display: flex; gap: 12px; align-items: center;
      ion-icon { font-size: 28px; }
    }
    .plan-label { margin: 0; font-size: 12px; opacity: 0.85; text-transform: uppercase; }
    .plan-name { margin: 2px 0 0; font-size: 22px; font-weight: 800; }
    .plan-price {
      margin: 14px 0 0;
      font-size: 26px; font-weight: 800;
      .per { font-size: 13px; opacity: 0.85; font-weight: 600; }
    }
    .plan-feats {
      margin: 14px 0 0;
      padding: 0;
      list-style: none;
      display: flex; flex-direction: column; gap: 8px;
      li { display: flex; align-items: center; gap: 8px; font-size: 14px; }
      ion-icon { color: #C9EED5; font-size: 18px; }
    }
    .notice {
      background: var(--ion-card-background);
      border: 1px solid var(--ion-border-color);
      border-radius: 16px;
      padding: 16px;
      display: flex; flex-direction: column; gap: 8px;
      .badge {
        align-self: flex-start;
        display: inline-flex; align-items: center; gap: 6px;
        background: var(--ion-color-light);
        color: var(--ion-color-medium);
        font-weight: 700; font-size: 12px;
        padding: 6px 12px;
        border-radius: 999px;
        ion-icon { font-size: 14px; }
      }
      p { margin: 0; font-size: 14px; color: var(--ion-color-medium); }
    }
  `],
})
export class SubscriptionPage {
  readonly auth = inject(AuthService);
  constructor() { addIcons({ sparklesOutline, checkmarkCircle, timeOutline }); }
}
