import { Component, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonRefresher, IonRefresherContent,
  IonIcon, IonSkeletonText, IonButtons, IonBackButton, IonInfiniteScroll,
  IonInfiniteScrollContent, IonSelect, IonSelectOption, IonInput,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { documentTextOutline, filterOutline } from 'ionicons/icons';

import { AuditLogService } from '../../core/services/audit-log.service';
import { ApiResponse, AuditLog, Paginated } from '../../core/models/api.models';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DatePipe, JsonPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonRefresher, IonRefresherContent,
    IonIcon, IonSkeletonText, IonButtons, IonBackButton, IonInfiniteScroll,
    IonInfiniteScrollContent, IonSelect, IonSelectOption, IonInput,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/more"></ion-back-button></ion-buttons>
        <ion-title>Audit log</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="reload($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="container-tight content-wrap">
        <div class="filter-card">
          <div class="filter-row">
            <ion-select label="Entity" labelPlacement="stacked" interface="popover"
              [(ngModel)]="filters.entity_type" (ionChange)="reload()">
              <ion-select-option [value]="undefined">All</ion-select-option>
              <ion-select-option value="Product">Product</ion-select-option>
              <ion-select-option value="Sale">Sale</ion-select-option>
              <ion-select-option value="Category">Category</ion-select-option>
              <ion-select-option value="Supplier">Supplier</ion-select-option>
              <ion-select-option value="Order">Order</ion-select-option>
              <ion-select-option value="MenuItem">MenuItem</ion-select-option>
              <ion-select-option value="Expense">Expense</ion-select-option>
            </ion-select>
            <ion-select label="Action" labelPlacement="stacked" interface="popover"
              [(ngModel)]="filters.action" (ionChange)="reload()">
              <ion-select-option [value]="undefined">All</ion-select-option>
              <ion-select-option value="created">created</ion-select-option>
              <ion-select-option value="updated">updated</ion-select-option>
              <ion-select-option value="deleted">deleted</ion-select-option>
              <ion-select-option value="voided">voided</ion-select-option>
              <ion-select-option value="refunded">refunded</ion-select-option>
              <ion-select-option value="partially_refunded">partially_refunded</ion-select-option>
              <ion-select-option value="committed">committed</ion-select-option>
              <ion-select-option value="suspended">suspended</ion-select-option>
              <ion-select-option value="stock_adjusted">stock_adjusted</ion-select-option>
              <ion-select-option value="stock_adjusted_with_override">stock_adjusted_with_override</ion-select-option>
            </ion-select>
          </div>
          <div class="filter-row">
            <ion-input label="From" labelPlacement="stacked" type="date" [(ngModel)]="filters.date_from" (ionBlur)="reload()"></ion-input>
            <ion-input label="To" labelPlacement="stacked" type="date" [(ngModel)]="filters.date_to" (ionBlur)="reload()"></ion-input>
          </div>
        </div>

        <div *ngIf="loading() && items().length === 0" class="surface-card">
          <ion-skeleton-text animated style="width: 80%; height: 14px;"></ion-skeleton-text>
          <ion-skeleton-text animated style="width: 60%; height: 14px;"></ion-skeleton-text>
        </div>

        <div *ngIf="!loading() && items().length === 0" class="empty">
          <ion-icon name="document-text-outline"></ion-icon>
          <p>No audit entries match these filters.</p>
        </div>

        <div *ngIf="items().length > 0" class="log-list">
          <div *ngFor="let log of items()" class="log-row">
            <div class="left">
              <span class="action" [attr.data-kind]="log.action">{{ log.action }}</span>
              <span class="entity">{{ log.entity_type || '—' }} <ng-container *ngIf="log.entity_id">#{{ log.entity_id }}</ng-container></span>
            </div>
            <div class="mid">
              <span class="who" *ngIf="log.user">{{ log.user.name }}</span>
              <span class="when">{{ log.created_at | date:'short' }}</span>
            </div>
            <details *ngIf="log.old_values || log.new_values" class="details">
              <summary>diff</summary>
              <pre>{{ log | json }}</pre>
            </details>
          </div>
        </div>

        <ion-infinite-scroll (ionInfinite)="loadMore($event)" [disabled]="!hasMore()">
          <ion-infinite-scroll-content></ion-infinite-scroll-content>
        </ion-infinite-scroll>
      </div>
    </ion-content>
  `,
  styles: [`
    .content-wrap { padding: 12px 0 32px; display: flex; flex-direction: column; gap: 12px; }
    .filter-card {
      background: var(--ion-card-background); border: 1px solid var(--ion-border-color);
      border-radius: 14px; padding: 8px 12px; display: flex; flex-direction: column; gap: 8px;
    }
    .filter-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .log-list {
      background: var(--ion-card-background); border: 1px solid var(--ion-border-color);
      border-radius: 14px; overflow: hidden;
    }
    .log-row {
      padding: 10px 14px; border-bottom: 1px solid var(--ion-border-color);
      display: grid; grid-template-columns: 1fr auto; row-gap: 6px;
      &:last-child { border-bottom: 0; }
      .left { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .action { font-weight: 600; font-size: 13px; }
      .action[data-kind^="deleted"], .action[data-kind^="voided"] { color: var(--ion-color-danger); }
      .action[data-kind^="created"], .action[data-kind^="committed"] { color: var(--ion-color-success); }
      .entity { font-size: 12px; color: var(--ion-color-medium); }
      .mid { text-align: right; font-size: 12px; color: var(--ion-color-medium); display: flex; flex-direction: column; gap: 2px; }
      .details { grid-column: 1 / -1; font-size: 11px; color: var(--ion-color-medium); }
      pre { background: var(--ion-color-light); padding: 8px; border-radius: 8px; overflow: auto; max-height: 200px; font-size: 11px; }
    }
    .empty { text-align: center; padding: 48px 24px; color: var(--ion-color-medium); ion-icon { font-size: 36px; } }
  `],
})
export class AuditLogsPage {
  private readonly auditLogs = inject(AuditLogService);
  private readonly toast = inject(ToastController);

  readonly loading = signal(true);
  readonly items = signal<AuditLog[]>([]);
  readonly page = signal(1);
  readonly hasMore = signal(true);

  filters: { entity_type?: string; action?: string; date_from?: string; date_to?: string } = {};

  constructor() {
    addIcons({ documentTextOutline, filterOutline });
    this.reload();
  }

  ionViewWillEnter(): void { this.reload(); }

  reload(event?: Event): void {
    this.page.set(1);
    this.hasMore.set(true);
    this.items.set([]);
    this.fetch().then(() => (event as any)?.target?.complete?.());
  }

  async loadMore(event: any): Promise<void> {
    if (!this.hasMore()) { event?.target?.complete?.(); return; }
    this.page.update((p) => p + 1);
    await this.fetch();
    event?.target?.complete?.();
  }

  private fetch(): Promise<void> {
    return new Promise((resolve) => {
      this.loading.set(true);
      this.auditLogs.list({ ...this.filters, page: this.page(), per_page: 25 }).subscribe({
        next: (res) => {
          const page = this.extract(res);
          const data = page?.data ?? [];
          this.items.update((prev) => this.page() === 1 ? data : [...prev, ...data]);
          const m = (page as any)?.meta;
          this.hasMore.set(m ? m.current_page < m.last_page : data.length === 25);
          this.loading.set(false);
          resolve();
        },
        error: async (err) => {
          this.loading.set(false);
          (await this.toast.create({
            message: err?.error?.message || 'Could not load audit logs',
            color: 'danger', duration: 1800, position: 'top',
          })).present();
          resolve();
        },
      });
    });
  }

  private extract(res: ApiResponse<Paginated<AuditLog>> | Paginated<AuditLog>): Paginated<AuditLog> {
    const env = res as ApiResponse<Paginated<AuditLog>>;
    return (env?.data ?? (res as Paginated<AuditLog>));
  }
}
