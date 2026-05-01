import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonRippleEffect,
  IonAlert, AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  walletOutline, layersOutline, swapHorizontalOutline, peopleOutline,
  settingsOutline, lockClosedOutline, logOutOutline, chevronForwardOutline,
  storefrontOutline, cardOutline, helpCircleOutline,
} from 'ionicons/icons';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-more',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonRippleEffect,
  ],
  templateUrl: './more.page.html',
  styleUrls: ['./more.page.scss'],
})
export class MorePage {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly alert = inject(AlertController);

  constructor() {
    addIcons({
      walletOutline, layersOutline, swapHorizontalOutline, peopleOutline,
      settingsOutline, lockClosedOutline, logOutOutline, chevronForwardOutline,
      storefrontOutline, cardOutline, helpCircleOutline,
    });
  }

  async logout(): Promise<void> {
    const a = await this.alert.create({
      header: 'Sign out?',
      message: 'You will need to sign in again to continue.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Sign out', role: 'destructive',
          handler: () => {
            // Best-effort server logout, but clear local state + navigate immediately.
            this.auth.logout().subscribe({ next: () => {}, error: () => {} });
            this.auth.clearLocalSession();
            this.router.navigateByUrl('/auth/login', { replaceUrl: true });
          },
        },
      ],
    });
    a.present();
  }
}
