import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonRefresher, IonRefresherContent,
  IonIcon, IonSkeletonText, IonFab, IonFabButton, IonModal, IonInput, IonTextarea,
  IonButton, IonSpinner, IonButtons, IonBackButton,
  AlertController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cubeOutline, addOutline, closeOutline, createOutline, trashOutline,
} from 'ionicons/icons';

import { SupplierService } from '../../core/services/supplier.service';
import { Supplier, Paginated, ApiResponse } from '../../core/models/api.models';

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonRefresher, IonRefresherContent,
    IonIcon, IonSkeletonText, IonFab, IonFabButton, IonModal, IonInput, IonTextarea,
    IonButton, IonSpinner, IonButtons, IonBackButton,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/more"></ion-back-button></ion-buttons>
        <ion-title>Suppliers</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="load($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="container-tight content-wrap">
        <div *ngIf="loading()" class="surface-card">
          <ion-skeleton-text animated style="width: 80%; height: 14px;"></ion-skeleton-text>
        </div>

        <div *ngIf="!loading() && items().length === 0" class="empty">
          <ion-icon name="cube-outline"></ion-icon>
          <p>No suppliers yet.</p>
          <small>Tap + to add one.</small>
        </div>

        <div *ngIf="!loading() && items().length > 0" class="sup-list">
          <div *ngFor="let s of items()" class="sup-row">
            <div class="sup-icon"><ion-icon name="cube-outline"></ion-icon></div>
            <div class="info">
              <p class="name">{{ s.name }}</p>
              <p class="meta" *ngIf="s.contact_name || s.phone">
                {{ s.contact_name }}<span *ngIf="s.phone"> · {{ s.phone }}</span>
              </p>
              <p class="meta" *ngIf="s.email">{{ s.email }}</p>
            </div>
            <div class="actions">
              <button type="button" class="row-action" (click)="openEdit(s)" aria-label="Edit">
                <ion-icon name="create-outline"></ion-icon>
              </button>
              <button type="button" class="row-action danger" (click)="confirmDelete(s)" aria-label="Remove">
                <ion-icon name="trash-outline"></ion-icon>
              </button>
            </div>
          </div>
        </div>
      </div>

      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button class="brand-fab" (click)="openAdd()"><ion-icon name="add-outline"></ion-icon></ion-fab-button>
      </ion-fab>
    </ion-content>

    <ion-modal [isOpen]="modalOpen()" (didDismiss)="modalOpen.set(false)" [breakpoints]="[0, 0.6, 0.95]" [initialBreakpoint]="0.75">
      <ng-template>
        <div class="modal-shell">
          <div class="modal-head">
            <h2>{{ editing() ? 'Edit supplier' : 'Add supplier' }}</h2>
            <button type="button" class="icon-btn" (click)="modalOpen.set(false)" aria-label="Close">
              <ion-icon name="close-outline"></ion-icon>
            </button>
          </div>
          <form [formGroup]="form" (ngSubmit)="save()" class="modal-body">
            <ion-input label="Name *" labelPlacement="stacked" formControlName="name" placeholder="e.g., ACME Trading"></ion-input>
            <ion-input label="Contact person" labelPlacement="stacked" formControlName="contact_name" placeholder="Optional"></ion-input>
            <ion-input label="Phone" labelPlacement="stacked" formControlName="phone" placeholder="Optional"></ion-input>
            <ion-input label="Email" labelPlacement="stacked" type="email" formControlName="email" placeholder="Optional"></ion-input>
            <ion-textarea label="Address" labelPlacement="stacked" rows="2" autoGrow="true" formControlName="address" placeholder="Optional"></ion-textarea>
            <ion-textarea label="Notes" labelPlacement="stacked" rows="2" autoGrow="true" formControlName="notes" placeholder="Optional"></ion-textarea>
            <ion-button expand="block" class="brand-btn" type="submit" [disabled]="submitting()">
              <ion-spinner *ngIf="submitting()" name="crescent" class="mr-2"></ion-spinner>
              {{ submitting() ? 'Saving…' : (editing() ? 'Save changes' : 'Add supplier') }}
            </ion-button>
          </form>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    ion-header ion-toolbar { --background: var(--ion-toolbar-background); }
    .content-wrap { padding-top: 12px; padding-bottom: 100px; display: flex; flex-direction: column; gap: 14px; }
    .sup-list {
      background: var(--ion-card-background);
      border: 1px solid var(--ion-border-color);
      border-radius: 16px; overflow: hidden;
    }
    .sup-row {
      display: grid; grid-template-columns: 40px 1fr auto; gap: 12px;
      align-items: center; padding: 12px 14px;
      border-bottom: 1px solid var(--ion-border-color);
      &:last-child { border-bottom: 0; }
      .sup-icon {
        width: 40px; height: 40px; border-radius: 12px;
        background: var(--baligya-50); color: var(--baligya-700);
        display: flex; align-items: center; justify-content: center;
        ion-icon { font-size: 20px; }
      }
      .info { min-width: 0; }
      .name { margin: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .meta { margin: 2px 0 0; font-size: 12px; color: var(--ion-color-medium); }
      .actions { display: inline-flex; gap: 6px; }
      .row-action {
        width: 32px; height: 32px; border-radius: 10px;
        border: 1px solid var(--ion-border-color);
        background: var(--ion-card-background); color: var(--ion-text-color);
        display: inline-flex; align-items: center; justify-content: center;
        ion-icon { font-size: 16px; }
        &.danger { color: var(--ion-color-danger); border-color: rgba(224,62,62,0.35); }
      }
    }
    .empty { text-align: center; padding: 56px 24px; color: var(--ion-color-medium); ion-icon { font-size: 36px; } p { margin: 8px 0 0; font-weight: 600; color: var(--ion-text-color); } small { font-size: 13px; } }
    .brand-fab { --background: var(--tenant-primary); --color: #fff; }
    .modal-shell { display: flex; flex-direction: column; height: 100%; padding: 0 16px 16px; padding-top: var(--safe-area-top); background: var(--ion-background-color); }
    .modal-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 0 8px; border-bottom: 1px solid var(--ion-border-color); h2 { margin: 0; font-size: 18px; font-weight: 700; } .icon-btn { width: 36px; height: 36px; border: 0; border-radius: 50%; background: var(--ion-color-light); display: inline-flex; align-items: center; justify-content: center; ion-icon { font-size: 20px; } } }
    .modal-body { display: flex; flex-direction: column; gap: 12px; padding: 12px 0 calc(20px + var(--safe-area-bottom)); }
    .mr-2 { margin-right: 8px; }
  `],
})
export class SuppliersPage {
  private readonly suppliers = inject(SupplierService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastController);
  private readonly alert = inject(AlertController);

  readonly loading = signal(true);
  readonly items = signal<Supplier[]>([]);
  readonly modalOpen = signal(false);
  readonly submitting = signal(false);
  readonly editing = signal<Supplier | null>(null);

  readonly form = this.fb.nonNullable.group({
    name:         ['', [Validators.required]],
    contact_name: [''],
    phone:        [''],
    email:        [''],
    address:      [''],
    notes:        [''],
  });

  constructor() {
    addIcons({ cubeOutline, addOutline, closeOutline, createOutline, trashOutline });
    this.load();
  }

  ionViewWillEnter(): void { this.load(); }

  load(event?: Event): void {
    this.loading.set(true);
    this.suppliers.list({ per_page: 100 }).subscribe({
      next: (res) => {
        const data = this.extract(res);
        this.items.set(data);
        this.loading.set(false);
        (event as any)?.target?.complete?.();
      },
      error: () => { this.loading.set(false); (event as any)?.target?.complete?.(); },
    });
  }

  private extract(res: ApiResponse<Paginated<Supplier>> | Paginated<Supplier>): Supplier[] {
    const env = res as ApiResponse<Paginated<Supplier>>;
    const page = env?.data ?? (res as Paginated<Supplier>);
    return (page as any)?.data ?? [];
  }

  openAdd(): void {
    this.editing.set(null);
    this.form.reset({ name: '', contact_name: '', phone: '', email: '', address: '', notes: '' });
    this.modalOpen.set(true);
  }

  openEdit(s: Supplier): void {
    this.editing.set(s);
    this.form.reset({
      name: s.name, contact_name: s.contact_name ?? '',
      phone: s.phone ?? '', email: s.email ?? '',
      address: s.address ?? '', notes: s.notes ?? '',
    });
    this.modalOpen.set(true);
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    const target = this.editing();
    const payload = this.form.getRawValue();
    const obs = target
      ? this.suppliers.update(target.id, payload as any)
      : this.suppliers.create(payload as any);
    obs.subscribe({
      next: () => {
        this.submitting.set(false);
        this.flash(target ? 'Supplier updated' : 'Supplier added', 'success');
        this.modalOpen.set(false);
        this.load();
      },
      error: (err) => {
        this.submitting.set(false);
        this.flash(err?.error?.message || 'Could not save', 'danger');
      },
    });
  }

  async confirmDelete(s: Supplier): Promise<void> {
    const a = await this.alert.create({
      header: `Remove ${s.name}?`,
      message: 'Products linked to this supplier will keep their stock but lose the supplier reference.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove', role: 'destructive',
          handler: () => {
            this.suppliers.destroy(s.id).subscribe({
              next: () => { this.flash('Supplier removed', 'success'); this.load(); },
              error: (err) => this.flash(err?.error?.message || 'Could not remove', 'danger'),
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
}
