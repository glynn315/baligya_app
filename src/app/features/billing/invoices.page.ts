import { Component, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonIcon,
  IonRefresher, IonRefresherContent, IonSkeletonText, IonRippleEffect,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  receiptOutline, checkmarkCircle, timeOutline, closeCircleOutline,
  alertCircleOutline, chevronForwardOutline,
} from 'ionicons/icons';

import { BillingService } from '../../core/services/billing.service';
import { Invoice } from '../../core/models/api.models';
import { PesoPipe } from '../../shared/pipes/peso.pipe';

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [
    CommonModule, DatePipe, PesoPipe, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonIcon,
    IonRefresher, IonRefresherContent, IonSkeletonText, IonRippleEffect,
  ],
  templateUrl: './invoices.page.html',
  styleUrls: ['./invoices.page.scss'],
})
export class InvoicesPage {
  private readonly billing = inject(BillingService);

  readonly loading = signal(true);
  readonly invoices = signal<Invoice[]>([]);

  constructor() {
    addIcons({
      receiptOutline, checkmarkCircle, timeOutline, closeCircleOutline,
      alertCircleOutline, chevronForwardOutline,
    });
    this.load();
  }

  ionViewWillEnter(): void { this.load(); }

  load(event?: Event): void {
    this.loading.set(true);
    this.billing.list({ per_page: 50 }).subscribe({
      next: (res: any) => {
        const data = res?.data?.data ?? res?.data ?? [];
        this.invoices.set(Array.isArray(data) ? data : []);
        this.loading.set(false);
        (event as any)?.target?.complete?.();
      },
      error: () => {
        this.loading.set(false);
        (event as any)?.target?.complete?.();
      },
    });
  }

  iconFor(status: string): string {
    switch (status) {
      case 'paid':      return 'checkmark-circle';
      case 'cancelled':
      case 'expired':   return 'close-circle-outline';
      default:          return 'time-outline';
    }
  }
}
