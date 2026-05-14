import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonSegment, IonSegmentButton, IonLabel, IonItem, IonInput,
  IonSpinner, IonRefresher, IonRefresherContent, IonList,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cashOutline, restaurantOutline, calendarOutline, statsChartOutline,
  trendingUpOutline, refreshOutline,
} from 'ionicons/icons';

import { EateryReportService } from '../../../core/services/eatery-report.service';
import {
  EateryDailyReport, EateryMonthlyReport, EaterySummary,
} from '../../../core/models/api.models';

type Tab = 'summary' | 'daily' | 'monthly';

@Component({
  selector: 'app-eatery-reports',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonSegment, IonSegmentButton, IonLabel, IonItem, IonInput,
    IonSpinner, IonRefresher, IonRefresherContent, IonList,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/more"></ion-back-button></ion-buttons>
        <ion-title>Reports</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [(ngModel)]="tab" (ionChange)="onTabChange()">
          <ion-segment-button value="summary"><ion-label>Today</ion-label></ion-segment-button>
          <ion-segment-button value="daily"><ion-label>Daily</ion-label></ion-segment-button>
          <ion-segment-button value="monthly"><ion-label>Monthly</ion-label></ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="reload($event)"><ion-refresher-content></ion-refresher-content></ion-refresher>

      <div class="spinner" *ngIf="loading()"><ion-spinner></ion-spinner></div>

      <!-- ── Summary tab ───────────────────────────────────── -->
      <ng-container *ngIf="!loading() && tab === 'summary' && summary() as s">
        <div class="grid">
          <div class="kpi big">
            <div class="kpi-label">Sales today</div>
            <div class="kpi-value">₱ {{ s.total_sales_today | number:'1.2-2' }}</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Orders today</div>
            <div class="kpi-value">{{ s.total_orders_today }}</div>
          </div>
        </div>

        <h3 class="section-title">Tables</h3>
        <div class="grid grid-3">
          <div class="kpi available">
            <div class="kpi-label">Available</div>
            <div class="kpi-value">{{ s.tables.available }}</div>
          </div>
          <div class="kpi occupied">
            <div class="kpi-label">Occupied</div>
            <div class="kpi-value">{{ s.tables.occupied }}</div>
          </div>
          <div class="kpi unpaid">
            <div class="kpi-label">Unpaid</div>
            <div class="kpi-value">{{ s.tables.not_yet_paid }}</div>
          </div>
        </div>
        <p class="footnote">Total tables: {{ s.tables.total }}</p>
      </ng-container>

      <!-- ── Daily tab ─────────────────────────────────────── -->
      <ng-container *ngIf="!loading() && tab === 'daily'">
        <ion-item>
          <ion-label position="stacked">Date</ion-label>
          <ion-input type="date" [(ngModel)]="dailyDate" (ionChange)="loadDaily()"></ion-input>
        </ion-item>

        <ng-container *ngIf="daily() as d">
          <div class="grid">
            <div class="kpi big">
              <div class="kpi-label">Revenue</div>
              <div class="kpi-value">₱ {{ d.total_revenue | number:'1.2-2' }}</div>
            </div>
          </div>
          <div class="grid grid-3">
            <div class="kpi available">
              <div class="kpi-label">Paid</div>
              <div class="kpi-value">{{ d.paid_orders }}</div>
            </div>
            <div class="kpi unpaid">
              <div class="kpi-label">Unpaid</div>
              <div class="kpi-value">{{ d.unpaid_orders }}</div>
            </div>
            <div class="kpi cancelled">
              <div class="kpi-label">Cancelled</div>
              <div class="kpi-value">{{ d.cancelled }}</div>
            </div>
          </div>

          <h3 class="section-title">Best selling — {{ d.date }}</h3>
          <ion-list class="best-list" *ngIf="d.best_selling.length > 0">
            <ion-item *ngFor="let row of d.best_selling; let i = index">
              <div slot="start" class="rank">#{{ i + 1 }}</div>
              <ion-label>
                <h3>{{ row.item_name }}</h3>
                <p>{{ row.total_quantity }} sold</p>
              </ion-label>
              <div slot="end" class="revenue">₱ {{ row.total_revenue | number:'1.2-2' }}</div>
            </ion-item>
          </ion-list>
          <p class="empty" *ngIf="d.best_selling.length === 0">No paid orders for this date.</p>
        </ng-container>
      </ng-container>

      <!-- ── Monthly tab ───────────────────────────────────── -->
      <ng-container *ngIf="!loading() && tab === 'monthly'">
        <div class="month-picker">
          <ion-item lines="none">
            <ion-label position="stacked">Year</ion-label>
            <ion-input type="number" [(ngModel)]="monthlyYear" (ionChange)="loadMonthly()"></ion-input>
          </ion-item>
          <ion-item lines="none">
            <ion-label position="stacked">Month</ion-label>
            <ion-input type="number" min="1" max="12" [(ngModel)]="monthlyMonth" (ionChange)="loadMonthly()"></ion-input>
          </ion-item>
        </div>

        <ng-container *ngIf="monthly() as m">
          <p class="footnote">{{ m.period_start }} → {{ m.period_end }}</p>
          <div class="grid">
            <div class="kpi big">
              <div class="kpi-label">Revenue</div>
              <div class="kpi-value">₱ {{ m.total_revenue | number:'1.2-2' }}</div>
            </div>
          </div>
          <div class="grid grid-3">
            <div class="kpi available">
              <div class="kpi-label">Paid</div>
              <div class="kpi-value">{{ m.paid_orders }}</div>
            </div>
            <div class="kpi unpaid">
              <div class="kpi-label">Unpaid</div>
              <div class="kpi-value">{{ m.unpaid_orders }}</div>
            </div>
            <div class="kpi cancelled">
              <div class="kpi-label">Cancelled</div>
              <div class="kpi-value">{{ m.cancelled }}</div>
            </div>
          </div>

          <h3 class="section-title">Best selling</h3>
          <ion-list class="best-list" *ngIf="m.best_selling.length > 0">
            <ion-item *ngFor="let row of m.best_selling; let i = index">
              <div slot="start" class="rank">#{{ i + 1 }}</div>
              <ion-label>
                <h3>{{ row.item_name }}</h3>
                <p>{{ row.total_quantity }} sold</p>
              </ion-label>
              <div slot="end" class="revenue">₱ {{ row.total_revenue | number:'1.2-2' }}</div>
            </ion-item>
          </ion-list>
          <p class="empty" *ngIf="m.best_selling.length === 0">No paid orders in this period.</p>
        </ng-container>
      </ng-container>
    </ion-content>
  `,
  styles: [`
    .spinner { display: flex; justify-content: center; padding: 40px; }

    .grid { display: grid; grid-template-columns: 1fr; gap: 10px; padding: 12px; }
    .grid-3 { grid-template-columns: 1fr 1fr 1fr; }

    .kpi {
      background: var(--ion-card-background, #fff);
      border-radius: 12px; padding: 14px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.05);
      border-left: 4px solid var(--ion-color-medium);
    }
    .kpi.big { padding: 20px; }
    .kpi-label { color: var(--ion-color-medium); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi-value { font-size: 26px; font-weight: 800; margin-top: 4px; }
    .kpi.big .kpi-value { font-size: 32px; }

    .kpi.available { border-left-color: #2dd36f; }
    .kpi.occupied  { border-left-color: #ffc409; }
    .kpi.unpaid    { border-left-color: #eb445a; }
    .kpi.cancelled { border-left-color: #92949c; }

    .section-title { padding: 16px 16px 6px; font-size: 14px; color: var(--ion-color-medium); text-transform: uppercase; letter-spacing: 0.5px; }
    .footnote { padding: 0 16px; color: var(--ion-color-medium); font-size: 12px; }
    .empty { padding: 24px 16px; color: var(--ion-color-medium); text-align: center; }

    .month-picker { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 8px; }

    .rank { font-weight: 800; color: var(--tenant-primary, #3880ff); }
    .revenue { font-weight: 700; color: var(--tenant-primary, #3880ff); }
    .best-list ion-item h3 { font-weight: 600; }
  `],
})
export class EateryReportsPage {
  private readonly api = inject(EateryReportService);
  private readonly toast = inject(ToastController);

  readonly loading = signal(false);
  readonly summary = signal<EaterySummary | null>(null);
  readonly daily = signal<EateryDailyReport | null>(null);
  readonly monthly = signal<EateryMonthlyReport | null>(null);

  tab: Tab = 'summary';
  dailyDate: string = this.todayIso();
  monthlyYear: number = new Date().getFullYear();
  monthlyMonth: number = new Date().getMonth() + 1;

  constructor() {
    addIcons({
      cashOutline, restaurantOutline, calendarOutline, statsChartOutline,
      trendingUpOutline, refreshOutline,
    });
    this.loadSummary();
  }

  ionViewWillEnter(): void {
    this.reload();
  }

  onTabChange(): void {
    if (this.tab === 'summary') this.loadSummary();
    else if (this.tab === 'daily') this.loadDaily();
    else this.loadMonthly();
  }

  reload(event?: Event): void {
    const done = () => (event as any)?.target?.complete?.();
    if (this.tab === 'summary') this.loadSummary(done);
    else if (this.tab === 'daily') this.loadDaily(done);
    else this.loadMonthly(done);
  }

  loadSummary(done?: () => void): void {
    this.loading.set(true);
    this.api.summary().subscribe({
      next: (res) => { this.summary.set(res.data ?? null); this.loading.set(false); done?.(); },
      error: (err) => { this.loading.set(false); done?.(); this.flashErr(err, 'Could not load summary'); },
    });
  }

  loadDaily(done?: () => void): void {
    this.loading.set(true);
    this.api.daily(this.dailyDate || undefined).subscribe({
      next: (res) => { this.daily.set(res.data ?? null); this.loading.set(false); done?.(); },
      error: (err) => { this.loading.set(false); done?.(); this.flashErr(err, 'Could not load daily report'); },
    });
  }

  loadMonthly(done?: () => void): void {
    this.loading.set(true);
    this.api.monthly(this.monthlyYear || undefined, this.monthlyMonth || undefined).subscribe({
      next: (res) => { this.monthly.set(res.data ?? null); this.loading.set(false); done?.(); },
      error: (err) => { this.loading.set(false); done?.(); this.flashErr(err, 'Could not load monthly report'); },
    });
  }

  private todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private async flashErr(err: any, fallback: string) {
    const message = err?.error?.message || fallback;
    const t = await this.toast.create({ message, duration: 2000, color: 'danger', position: 'top' });
    t.present();
  }
}
