import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon, IonRefresher,
  IonRefresherContent, IonSpinner, IonModal, IonInput, IonItem, IonLabel,
  IonButtons, IonBackButton, ToastController, IonRippleEffect,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline, restaurantOutline, refreshOutline, createOutline,
  trashOutline, checkmarkCircle, alertCircle, closeOutline,
} from 'ionicons/icons';

import { RestaurantTableService } from '../../../core/services/restaurant-table.service';
import { RestaurantTable } from '../../../core/models/api.models';

@Component({
  selector: 'app-eatery-tables',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon,
    IonRefresher, IonRefresherContent, IonSpinner, IonModal, IonInput,
    IonItem, IonLabel, IonButtons, IonBackButton, IonRippleEffect,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/dashboard"></ion-back-button></ion-buttons>
        <ion-title>Tables</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="openCreate()"><ion-icon name="add-outline" slot="icon-only"></ion-icon></ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="load($event)"><ion-refresher-content></ion-refresher-content></ion-refresher>

      <div class="summary" *ngIf="!loading()">
        <div class="chip available">{{ countDerived('available') }} Available</div>
        <div class="chip unpaid">{{ countDerived('not_yet_paid') }} Unpaid</div>
        <ion-button size="small" fill="clear" (click)="sync()" *ngIf="hasAnomaly()">
          <ion-icon name="refresh-outline" slot="start"></ion-icon>
          Sync ({{ anomalyCount() }})
        </ion-button>
      </div>

      <div class="empty" *ngIf="!loading() && tables().length === 0">
        <ion-icon name="restaurant-outline"></ion-icon>
        <p>No tables yet. Tap + to add your first one.</p>
      </div>

      <div class="spinner" *ngIf="loading()"><ion-spinner></ion-spinner></div>

      <div class="grid">
        <div
          *ngFor="let t of tables(); trackBy: trackById"
          class="card ion-activatable"
          [class.available]="derived(t) === 'available'"
          [class.unpaid]="derived(t) === 'not_yet_paid'"
          (click)="open(t)">
          <ion-ripple-effect></ion-ripple-effect>
          <div class="num">{{ t.table_number }}</div>
          <div class="label">{{ t.label || 'Table ' + t.table_number }}</div>
          <div class="status">{{ statusLabel(derived(t)) }}</div>
          <div class="total" *ngIf="t.active_order">₱ {{ t.active_order.total_amount | number:'1.2-2' }}</div>
        </div>
      </div>
    </ion-content>

    <ion-modal [isOpen]="formOpen()" (didDismiss)="formOpen.set(false)">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ editing() ? 'Edit Table' : 'New Table' }}</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="formOpen.set(false)"><ion-icon name="close-outline" slot="icon-only"></ion-icon></ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <ion-item>
            <ion-label position="stacked">Table number *</ion-label>
            <ion-input type="number" [(ngModel)]="form.table_number" min="1"></ion-input>
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Label</ion-label>
            <ion-input type="text" [(ngModel)]="form.label" placeholder="e.g. VIP-1"></ion-input>
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Seats</ion-label>
            <ion-input type="number" [(ngModel)]="form.seats" min="1"></ion-input>
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Notes</ion-label>
            <ion-input type="text" [(ngModel)]="form.notes"></ion-input>
          </ion-item>

          <ion-button expand="block" class="ion-margin-top" (click)="save()" [disabled]="saving()">
            <ion-spinner *ngIf="saving()" name="dots" slot="start"></ion-spinner>
            {{ editing() ? 'Update' : 'Create' }}
          </ion-button>

          <ion-button *ngIf="editing()" expand="block" color="danger" fill="outline"
                      class="ion-margin-top" (click)="remove()" [disabled]="saving()">
            <ion-icon name="trash-outline" slot="start"></ion-icon>
            Delete
          </ion-button>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .summary { display: flex; gap: 8px; padding: 12px 16px; flex-wrap: wrap; }
    .chip {
      padding: 6px 12px; border-radius: 999px; font-size: 13px; font-weight: 600;
      background: var(--ion-color-light);
    }
    .chip.available { background: rgba(45,211,111,0.15); color: #2dd36f; }
    .chip.occupied  { background: rgba(255,196,9,0.15); color: #ffc409; }
    .chip.unpaid    { background: rgba(235,68,90,0.15); color: #eb445a; }

    .empty { text-align: center; padding: 60px 24px; color: var(--ion-color-medium); }
    .empty ion-icon { font-size: 60px; margin-bottom: 12px; }
    .spinner { display: flex; justify-content: center; padding: 40px; }

    .grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 12px; padding: 12px;
    }
    .card {
      position: relative; overflow: hidden;
      background: var(--ion-card-background, #fff); border-radius: 12px;
      padding: 16px 12px; text-align: center; cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.06); border: 2px solid transparent;
      transition: transform .15s;
    }
    .card:active { transform: scale(0.97); }
    .card.available { border-color: #2dd36f; }
    .card.occupied  { border-color: #ffc409; }
    .card.unpaid    { border-color: #eb445a; }

    .num { font-size: 28px; font-weight: 800; line-height: 1; }
    .label { font-weight: 600; margin-top: 4px; }
    .seats { font-size: 12px; color: var(--ion-color-medium); }
    .status { margin-top: 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .total { margin-top: 4px; font-weight: 700; color: #eb445a; }
  `],
})
export class EateryTablesPage {
  private readonly api = inject(RestaurantTableService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastController);

  readonly loading = signal(true);
  readonly tables = signal<RestaurantTable[]>([]);
  readonly formOpen = signal(false);
  readonly editing = signal<RestaurantTable | null>(null);
  readonly saving = signal(false);

  form: any = { table_number: null, label: '', seats: 4, notes: '' };

  constructor() {
    addIcons({
      addOutline, restaurantOutline, refreshOutline, createOutline,
      trashOutline, checkmarkCircle, alertCircle, closeOutline,
    });
    this.load();
  }

  ionViewWillEnter(): void { this.load(); }

  load(event?: Event): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (res) => {
        this.tables.set(res.data ?? []);
        this.loading.set(false);
        (event as any)?.target?.complete?.();
      },
      error: () => {
        this.loading.set(false);
        (event as any)?.target?.complete?.();
        this.flash('Could not load tables', 'danger');
      },
    });
  }

  /** Truth comes from `active_order` presence — `t.status` can drift. */
  derived(t: RestaurantTable): 'available' | 'not_yet_paid' {
    return t.active_order ? 'not_yet_paid' : 'available';
  }

  countDerived(status: 'available' | 'not_yet_paid'): number {
    return this.tables().filter((t) => this.derived(t) === status).length;
  }

  /** Count tables whose stored `status` disagrees with the derived truth. */
  anomalyCount(): number {
    return this.tables().filter((t) => {
      const expected = this.derived(t);
      const current = t.status === 'occupied' ? 'not_yet_paid' : t.status;
      return current !== expected;
    }).length;
  }

  hasAnomaly(): boolean {
    return this.anomalyCount() > 0;
  }

  sync(): void {
    this.api.syncStatuses().subscribe({
      next: (res) => {
        this.flash(`Synced ${res.data?.healed ?? 0} table(s)`, 'success');
        this.load();
      },
      error: (err) => this.flash(err?.error?.message || 'Sync failed', 'danger'),
    });
  }

  statusLabel(s: string): string {
    if (s === 'not_yet_paid') return 'Not yet paid';
    return 'Available';
  }

  open(t: RestaurantTable): void {
    this.router.navigate(['/eatery/tables', t.restaurant_table_id]);
  }

  openCreate(): void {
    this.editing.set(null);
    this.form = { table_number: null, label: '', seats: 4, notes: '' };
    this.formOpen.set(true);
  }

  openEdit(t: RestaurantTable): void {
    this.editing.set(t);
    this.form = {
      table_number: t.table_number,
      label: t.label || '',
      seats: t.seats,
      notes: t.notes || '',
    };
    this.formOpen.set(true);
  }

  save(): void {
    if (!this.form.table_number) {
      this.flash('Table number is required', 'warning');
      return;
    }
    this.saving.set(true);
    const obs = this.editing()
      ? this.api.update(this.editing()!.restaurant_table_id, this.form)
      : this.api.create(this.form);
    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.flash(this.editing() ? 'Table updated' : 'Table created', 'success');
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.flash(err?.error?.message || 'Could not save table', 'danger');
      },
    });
  }

  remove(): void {
    const t = this.editing();
    if (!t) return;
    if (!confirm(`Delete table ${t.table_number}?`)) return;
    this.saving.set(true);
    this.api.delete(t.restaurant_table_id).subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.flash('Table deleted', 'success');
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.flash(err?.error?.message || 'Could not delete', 'danger');
      },
    });
  }

  trackById = (_: number, t: RestaurantTable) => t.restaurant_table_id;

  private async flash(message: string, color: 'success' | 'danger' | 'warning') {
    const t = await this.toast.create({ message, duration: 1800, color, position: 'top' });
    t.present();
  }
}
