import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { mailUnreadOutline, refreshOutline, logOutOutline } from 'ionicons/icons';

import { AuthService } from '../../../core/services/auth.service';
import { BrandHeaderComponent } from '../../../shared/components/brand-header.component';

@Component({
  selector: 'app-verify-pending',
  standalone: true,
  imports: [CommonModule, BrandHeaderComponent, IonContent, IonButton, IonIcon],
  template: `
    <ion-content [fullscreen]="true">
      <div class="shell container-tight">
        <app-brand-header [compact]="true" title="Almost there"
          subtitle="We've sent a verification link to your email. Click it to activate your store.">
        </app-brand-header>

        <div class="surface-card center">
          <div class="icon-wrap"><ion-icon name="mail-unread-outline"></ion-icon></div>
          <p class="email" *ngIf="auth.user()?.email">{{ auth.user()?.email }}</p>
          <p class="hint">Once verified, sign in again to access your dashboard.</p>
        </div>

        <div class="actions">
          <ion-button expand="block" class="brand-btn" (click)="recheck()">
            <ion-icon slot="start" name="refresh-outline"></ion-icon>
            I've verified — refresh
          </ion-button>
          <ion-button expand="block" fill="clear" (click)="signOut()">
            <ion-icon slot="start" name="log-out-outline"></ion-icon>
            Sign out
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .shell { padding-top: var(--safe-area-top); padding-bottom: 24px; }
    .surface-card { text-align: center; margin-top: 12px; }
    .center { display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .icon-wrap {
      width: 64px; height: 64px; border-radius: 50%;
      background: var(--baligya-50); color: var(--baligya-600);
      display: flex; align-items: center; justify-content: center;
      ion-icon { font-size: 36px; }
    }
    .email { font-weight: 600; margin: 8px 0 0; }
    .hint { color: var(--ion-color-medium); margin: 4px 0 0; font-size: 14px; }
    .actions { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
  `],
})
export class VerifyPendingPage {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  recheck(): void {
    this.auth.me().subscribe({
      next: (res) => {
        if (res.data?.tenant?.is_verified) {
          this.router.navigate(['/tabs/dashboard'], { replaceUrl: true });
        }
      },
    });
  }

  signOut(): void {
    this.auth.clearLocalSession();
    this.router.navigate(['/auth/login'], { replaceUrl: true });
  }
}
