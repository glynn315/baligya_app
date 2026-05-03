import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonIcon,
  IonSkeletonText, IonButton, IonSpinner, IonRippleEffect,
  AlertController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  sparklesOutline, checkmarkCircle, timeOutline, ribbonOutline,
  peopleOutline, cubeOutline, refreshOutline, receiptOutline,
} from 'ionicons/icons';

import { AuthService } from '../../../core/services/auth.service';
import { SubscriptionService } from '../../../core/services/tenant.service';
import { Invoice, SubscriptionPlan } from '../../../core/models/api.models';
import { PesoPipe } from '../../../shared/pipes/peso.pipe';

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [
    CommonModule, DatePipe, PesoPipe, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonIcon,
    IonSkeletonText, IonButton, IonSpinner, IonRippleEffect,
  ],
  templateUrl: './subscription.page.html',
  styleUrls: ['./subscription.page.scss'],
})
export class SubscriptionPage {
  readonly auth = inject(AuthService);
  private readonly subs = inject(SubscriptionService);
  private readonly alert = inject(AlertController);
  private readonly toast = inject(ToastController);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly switching = signal<number | null>(null);
  readonly plans = signal<SubscriptionPlan[]>([]);

  readonly currentPlanId = computed(() => this.auth.tenant()?.subscription_plan?.id ?? null);
  readonly currentPlan   = computed(() => this.auth.tenant()?.subscription_plan ?? null);
  readonly endsAt        = computed(() => this.auth.tenant()?.subscription_ends_at ?? null);
  readonly isActive      = computed(() => !!this.auth.tenant()?.has_active_subscription);

  constructor() {
    addIcons({
      sparklesOutline, checkmarkCircle, timeOutline, ribbonOutline,
      peopleOutline, cubeOutline, refreshOutline,
    });
    this.load();
  }

  ionViewWillEnter(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.subs.plans().subscribe({
      next: (res) => {
        this.plans.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    // Refresh tenant/plan in the background so the "Current plan" card stays accurate.
    this.subs.current().subscribe({ error: () => {} });
  }

  formatLimit(n: number | undefined | null): string {
    if (n === undefined || n === null) return '—';
    if (n === -1) return 'Unlimited';
    return String(n);
  }

  async pick(plan: SubscriptionPlan): Promise<void> {
    if (plan.id === this.currentPlanId()) return;

    const a = await this.alert.create({
      header: `Switch to ${plan.display_name || plan.name}?`,
      message: this.confirmMessage(plan),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Confirm',
          handler: () => this.commitChange(plan),
        },
      ],
    });
    a.present();
  }

  private confirmMessage(plan: SubscriptionPlan): string {
    const price = Number(plan.price || 0);
    const cycle = plan.billing_cycle === 'yearly' ? 'year' : 'month';
    if (price <= 0) {
      return `You'll switch to ${plan.display_name || plan.name} immediately.`;
    }
    return `You'll be billed ₱${price.toFixed(2)}/${cycle}. The change takes effect immediately.`;
  }

  private commitChange(plan: SubscriptionPlan): void {
    this.switching.set(plan.id);
    this.subs.change(plan.id).subscribe({
      next: (res) => {
        this.switching.set(null);
        const data = res.data as any;
        // Paid plan → backend returns an Invoice; route to billing.
        if (data && 'invoice_number' in data) {
          this.router.navigateByUrl(`/billing/invoices/${(data as Invoice).id}`);
          return;
        }
        // Free plan → applied immediately.
        this.flash(`You're now on ${plan.display_name || plan.name}`, 'success');
      },
      error: (err) => {
        this.switching.set(null);
        // 409 means there's already an open invoice — route the user there.
        if (err?.status === 409 && err?.error?.data?.id) {
          this.alert.create({
            header: 'Finish your open invoice',
            message: err.error.message
              || 'You already have an invoice awaiting payment or verification.',
            buttons: [
              { text: 'Not now', role: 'cancel' },
              {
                text: 'Open invoice',
                handler: () => this.router.navigateByUrl(`/billing/invoices/${err.error.data.id}`),
              },
            ],
          }).then((a) => a.present());
          return;
        }
        this.flash(err?.error?.message || 'Could not change plan', 'danger');
      },
    });
  }

  private async flash(message: string, color: 'success' | 'danger'): Promise<void> {
    const t = await this.toast.create({ message, duration: 2000, color, position: 'top' });
    t.present();
  }
}
