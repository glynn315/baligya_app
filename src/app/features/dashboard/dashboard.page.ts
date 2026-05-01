import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonContent, IonRefresher, IonRefresherContent,
  IonIcon, IonSkeletonText, IonRippleEffect, IonSegment, IonSegmentButton, IonLabel,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cartOutline, cubeOutline, receiptOutline, walletOutline, trendingUpOutline,
  alertCircleOutline, addOutline, statsChartOutline, arrowForwardOutline,
  notificationsOutline, trendingDownOutline, swapVerticalOutline,
} from 'ionicons/icons';

import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { ProductService } from '../../core/services/product.service';
import { SaleService } from '../../core/services/sale.service';
import { ExpenseService } from '../../core/services/expense.service';
import { DashboardSummary, Product, Sale, Expense, PeriodTotals } from '../../core/models/api.models';
import { PesoPipe } from '../../shared/pipes/peso.pipe';

type Period = 'today' | 'month';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink, PesoPipe,
    IonHeader, IonToolbar, IonContent, IonRefresher, IonRefresherContent,
    IonIcon, IonSkeletonText, IonRippleEffect, IonSegment, IonSegmentButton, IonLabel,
  ],
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage {
  readonly auth = inject(AuthService);
  private readonly dashboard = inject(DashboardService);
  private readonly products = inject(ProductService);
  private readonly sales = inject(SaleService);
  private readonly expenses = inject(ExpenseService);

  readonly loading = signal(true);
  readonly period = signal<Period>('today');
  readonly summary = signal<DashboardSummary | null>(null);
  readonly topProducts = signal<Product[]>([]);
  readonly lowStock = signal<Product[]>([]);

  // Local fallback aggregations when backend doesn't return month/today blocks
  readonly localToday = signal<PeriodTotals>({ sales_total: 0, sales_count: 0, expenses_total: 0, net_income: 0 });
  readonly localMonth = signal<PeriodTotals>({ sales_total: 0, sales_count: 0, expenses_total: 0, net_income: 0 });

  readonly activeTotals = computed<PeriodTotals>(() => {
    const s = this.summary();
    const p = this.period();
    const fromApi = (p === 'today' ? s?.today : s?.month) ?? {};
    const local = p === 'today' ? this.localToday() : this.localMonth();
    // Prefer API values; fill gaps with local computation.
    return {
      sales_total:    fromApi.sales_total    ?? local.sales_total,
      sales_count:    fromApi.sales_count    ?? local.sales_count,
      expenses_total: fromApi.expenses_total ?? local.expenses_total,
      net_income:     fromApi.net_income ?? fromApi.profit ?? local.net_income,
    };
  });

  readonly greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  });

  constructor() {
    addIcons({
      cartOutline, cubeOutline, receiptOutline, walletOutline, trendingUpOutline,
      alertCircleOutline, addOutline, statsChartOutline, arrowForwardOutline,
      notificationsOutline, trendingDownOutline, swapVerticalOutline,
    });
    this.load();
  }

  ionViewWillEnter(): void { this.load(); }

  setPeriod(value: string | number | undefined | null): void {
    if (value === 'today' || value === 'month') this.period.set(value);
  }

  load(event?: Event): void {
    this.loading.set(true);
    this.dashboard.summary().subscribe({
      next: (res) => { this.summary.set(res.data ?? null); this.done(event); },
      error: () => this.done(event),
    });
    this.dashboard.topProducts(5).subscribe({
      next: (res) => this.topProducts.set(res.data ?? []),
    });
    this.products.lowStock().subscribe({
      next: (res) => this.lowStock.set(res.data ?? []),
    });
    this.computeLocalTotals();
  }

  /** Pulls recent sales + expenses, aggregates today/this-month locally as a fallback. */
  private computeLocalTotals(): void {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

    this.sales.list({ per_page: 200 }).subscribe({
      next: (res: any) => {
        const items: Sale[] = res?.data?.data ?? res?.data ?? [];
        const today = { total: 0, count: 0 };
        const month = { total: 0, count: 0 };
        for (const s of items) {
          if (s.status === 'voided') continue;
          const at = new Date(s.created_at);
          if (at >= startOfDay) { today.total += Number(s.total || 0); today.count += 1; }
          if (at >= startOfMonth) { month.total += Number(s.total || 0); month.count += 1; }
        }
        this.localToday.update((v) => ({ ...v, sales_total: today.total, sales_count: today.count }));
        this.localMonth.update((v) => ({ ...v, sales_total: month.total, sales_count: month.count }));
        this.recomputeNet();
      },
    });

    this.expenses.list({ per_page: 200 }).subscribe({
      next: (res: any) => {
        const items: Expense[] = res?.data?.data ?? res?.data ?? [];
        let today = 0, month = 0;
        for (const e of items) {
          const at = new Date(e.expense_date || e.created_at);
          if (at >= startOfDay) today += Number(e.amount || 0);
          if (at >= startOfMonth) month += Number(e.amount || 0);
        }
        this.localToday.update((v) => ({ ...v, expenses_total: today }));
        this.localMonth.update((v) => ({ ...v, expenses_total: month }));
        this.recomputeNet();
      },
    });
  }

  private recomputeNet(): void {
    this.localToday.update((v) => ({
      ...v,
      net_income: (v.sales_total ?? 0) - (v.expenses_total ?? 0),
    }));
    this.localMonth.update((v) => ({
      ...v,
      net_income: (v.sales_total ?? 0) - (v.expenses_total ?? 0),
    }));
  }

  private done(event?: Event): void {
    this.loading.set(false);
    (event as any)?.target?.complete?.();
  }
}
