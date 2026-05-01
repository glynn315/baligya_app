import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonRefresher, IonRefresherContent,
  IonIcon, IonSkeletonText, IonSegment, IonSegmentButton, IonLabel,
  AlertController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { receiptOutline, timeOutline, banOutline, ellipsisVerticalOutline } from 'ionicons/icons';

import { SaleService } from '../../core/services/sale.service';
import { Sale } from '../../core/models/api.models';
import { PesoPipe } from '../../shared/pipes/peso.pipe';

type Filter = 'all' | 'completed' | 'voided';

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [
    CommonModule, DatePipe, PesoPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonRefresher, IonRefresherContent,
    IonIcon, IonSkeletonText, IonSegment, IonSegmentButton, IonLabel,
  ],
  templateUrl: './sales.page.html',
  styleUrls: ['./sales.page.scss'],
})
export class SalesPage {
  private readonly sales = inject(SaleService);
  private readonly alert = inject(AlertController);
  private readonly toast = inject(ToastController);

  readonly loading = signal(true);
  readonly items = signal<Sale[]>([]);
  readonly filter = signal<Filter>('all');

  readonly filtered = computed(() => {
    const f = this.filter();
    if (f === 'all') return this.items();
    return this.items().filter((s) => s.status === f);
  });

  readonly totalSales = computed(() =>
    this.filtered()
      .filter((s) => s.status === 'completed')
      .reduce((sum, s) => sum + Number(s.total || 0), 0),
  );

  constructor() {
    addIcons({ receiptOutline, timeOutline, banOutline, ellipsisVerticalOutline });
    this.load();
  }

  async confirmVoid(sale: Sale): Promise<void> {
    if (sale.status === 'voided') return;
    const a = await this.alert.create({
      header: `Void sale #${sale.transaction_number}?`,
      message: 'Stock will be returned. This cannot be undone.',
      inputs: [{ name: 'reason', type: 'text', placeholder: 'Reason (optional)' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Void', role: 'destructive',
          handler: (data) => {
            this.sales.void(sale.id, data?.reason).subscribe({
              next: () => { this.flash('Sale voided', 'success'); this.load(); },
              error: (err) => this.flash(err?.error?.message || 'Could not void sale', 'danger'),
            });
          },
        },
      ],
    });
    a.present();
  }

  private async flash(message: string, color: 'success' | 'danger') {
    const t = await this.toast.create({ message, duration: 1800, color, position: 'top' });
    t.present();
  }

  ionViewWillEnter(): void { this.load(); }

  load(event?: Event): void {
    this.loading.set(true);
    this.sales.list({ per_page: 50 }).subscribe({
      next: (res: any) => {
        const data = res?.data?.data ?? res?.data ?? [];
        this.items.set(Array.isArray(data) ? data : []);
        this.loading.set(false);
        (event as any)?.target?.complete?.();
      },
      error: () => {
        this.loading.set(false);
        (event as any)?.target?.complete?.();
      },
    });
  }

  setFilter(value: string | number | undefined | null): void {
    if (value === 'all' || value === 'completed' || value === 'voided') {
      this.filter.set(value);
    }
  }
}
