import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonIcon,
  IonSkeletonText, IonInput, IonButton, IonSpinner,
  AlertController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  qrCodeOutline, copyOutline, checkmarkCircle, closeCircleOutline, timeOutline,
  receiptOutline, alertCircleOutline, arrowBackOutline,
} from 'ionicons/icons';

import { BillingService } from '../../core/services/billing.service';
import { Invoice } from '../../core/models/api.models';
import { PesoPipe } from '../../shared/pipes/peso.pipe';

@Component({
  selector: 'app-invoice-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DatePipe, PesoPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonIcon,
    IonSkeletonText, IonInput, IonButton, IonSpinner,
  ],
  templateUrl: './invoice-detail.page.html',
  styleUrls: ['./invoice-detail.page.scss'],
})
export class InvoiceDetailPage {
  private readonly billing = inject(BillingService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alert = inject(AlertController);
  private readonly toast = inject(ToastController);

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly cancelling = signal(false);
  readonly invoice = signal<Invoice | null>(null);
  readonly reference = signal<string>('');

  readonly merchant = computed(() => this.invoice()?.merchant ?? null);
  // The reference-submission form is shown only while the invoice is still
  // payable. Once submitted, the user waits for admin verification.
  readonly canSubmitReference = computed(() => this.invoice()?.status === 'pending');
  readonly isSubmitted = computed(() => this.invoice()?.status === 'submitted');
  readonly isClosed = computed(() => {
    const s = this.invoice()?.status;
    return s === 'paid' || s === 'cancelled' || s === 'expired';
  });
  readonly qrSrc = computed(() => {
    const path = this.merchant()?.qr_path;
    if (!path) return null;
    // Absolute URLs ride as-is; relative paths resolve against the app's asset root.
    return /^https?:\/\//i.test(path) ? path : path.replace(/^\//, '');
  });

  constructor() {
    addIcons({
      qrCodeOutline, copyOutline, checkmarkCircle, closeCircleOutline, timeOutline,
      receiptOutline, alertCircleOutline, arrowBackOutline,
    });
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) this.load(id);
  }

  ionViewWillEnter(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) this.load(id);
  }

  load(id: number): void {
    this.loading.set(true);
    this.billing.show(id).subscribe({
      next: (res) => {
        this.invoice.set(res.data ?? null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setReference(value: string | number | null | undefined): void {
    this.reference.set((value ?? '').toString().trim());
  }

  async copy(text: string | null | undefined): Promise<void> {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.flash('Copied', 'success');
    } catch {
      this.flash('Could not copy', 'danger');
    }
  }

  submit(): void {
    const inv = this.invoice();
    const ref = this.reference();
    if (!inv) return;
    if (ref.length < 6) {
      this.flash('Reference must be at least 6 characters', 'danger');
      return;
    }

    this.submitting.set(true);
    this.billing.pay(inv.id, ref).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.invoice.set(res.data ?? this.invoice());
        this.reference.set('');
        this.flash('Reference submitted — awaiting verification', 'success');
      },
      error: (err) => {
        this.submitting.set(false);
        this.flash(err?.error?.message || 'Could not submit reference', 'danger');
      },
    });
  }

  async confirmCancel(): Promise<void> {
    const inv = this.invoice();
    if (!inv || (inv.status !== 'pending' && inv.status !== 'submitted')) return;

    const a = await this.alert.create({
      header: 'Cancel this invoice?',
      message: 'Cancelling stops this plan change. You can issue a new invoice anytime.',
      buttons: [
        { text: 'Keep invoice', role: 'cancel' },
        {
          text: 'Cancel invoice', role: 'destructive',
          handler: () => this.doCancel(inv.id),
        },
      ],
    });
    a.present();
  }

  private doCancel(id: number): void {
    this.cancelling.set(true);
    this.billing.cancel(id).subscribe({
      next: (res) => {
        this.cancelling.set(false);
        this.invoice.set(res.data ?? this.invoice());
        this.flash('Invoice cancelled', 'success');
      },
      error: (err) => {
        this.cancelling.set(false);
        this.flash(err?.error?.message || 'Could not cancel invoice', 'danger');
      },
    });
  }

  back(): void { this.router.navigateByUrl('/billing/invoices'); }

  private async flash(message: string, color: 'success' | 'danger'): Promise<void> {
    const t = await this.toast.create({ message, duration: 2200, color, position: 'top' });
    t.present();
  }
}
