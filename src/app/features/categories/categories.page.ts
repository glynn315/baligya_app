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
  layersOutline, addOutline, closeOutline, createOutline, trashOutline,
} from 'ionicons/icons';

import { CategoryService } from '../../core/services/product.service';
import { Category } from '../../core/models/api.models';

@Component({
  selector: 'app-categories',
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
        <ion-title>Categories</ion-title>
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
          <ion-icon name="layers-outline"></ion-icon>
          <p>No categories yet.</p>
          <small>Tap + to add one.</small>
        </div>

        <div *ngIf="!loading() && items().length > 0" class="cat-list">
          <div *ngFor="let c of items()" class="cat-row">
            <div class="cat-icon"><ion-icon name="layers-outline"></ion-icon></div>
            <div class="info">
              <p class="name">{{ c.name }}</p>
              <p class="meta" *ngIf="c.description">{{ c.description }}</p>
            </div>
            <div class="actions">
              <button type="button" class="row-action" (click)="openEdit(c)" aria-label="Edit">
                <ion-icon name="create-outline"></ion-icon>
              </button>
              <button type="button" class="row-action danger" (click)="confirmDelete(c)" aria-label="Remove">
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

    <ion-modal [isOpen]="modalOpen()" (didDismiss)="modalOpen.set(false)" [breakpoints]="[0, 0.55, 0.9]" [initialBreakpoint]="0.65">
      <ng-template>
        <div class="modal-shell">
          <div class="modal-head">
            <h2>{{ editing() ? 'Edit category' : 'Add category' }}</h2>
            <button type="button" class="icon-btn" (click)="modalOpen.set(false)" aria-label="Close">
              <ion-icon name="close-outline"></ion-icon>
            </button>
          </div>
          <form [formGroup]="form" (ngSubmit)="save()" class="modal-body">
            <div class="field">
              <ion-input label="Name" labelPlacement="stacked" formControlName="name" placeholder="e.g., Beverages"></ion-input>
            </div>
            <div class="field">
              <ion-textarea label="Description" labelPlacement="stacked" rows="2" autoGrow="true" formControlName="description" placeholder="optional"></ion-textarea>
            </div>
            <ion-button expand="block" class="brand-btn" type="submit" [disabled]="submitting()">
              <ion-spinner *ngIf="submitting()" name="crescent" class="mr-2"></ion-spinner>
              {{ submitting() ? 'Saving…' : (editing() ? 'Save changes' : 'Add category') }}
            </ion-button>
          </form>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    ion-header ion-toolbar { --background: var(--ion-toolbar-background); }
    .content-wrap { padding-top: 12px; padding-bottom: 100px; display: flex; flex-direction: column; gap: 14px; }
    .cat-list {
      background: var(--ion-card-background);
      border: 1px solid var(--ion-border-color);
      border-radius: 16px; overflow: hidden;
    }
    .cat-row {
      display: grid; grid-template-columns: 40px 1fr auto; gap: 12px;
      align-items: center; padding: 12px 14px;
      border-bottom: 1px solid var(--ion-border-color);
      &:last-child { border-bottom: 0; }
      .cat-icon {
        width: 40px; height: 40px; border-radius: 12px;
        background: var(--baligya-50); color: var(--baligya-700);
        display: flex; align-items: center; justify-content: center;
        ion-icon { font-size: 20px; }
      }
      .info { min-width: 0; }
      .name { margin: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .meta { margin: 2px 0 0; font-size: 12px; color: var(--ion-color-medium);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
export class CategoriesPage {
  private readonly categories = inject(CategoryService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastController);
  private readonly alert = inject(AlertController);

  readonly loading = signal(true);
  readonly items = signal<Category[]>([]);
  readonly modalOpen = signal(false);
  readonly submitting = signal(false);
  readonly editing = signal<Category | null>(null);

  readonly form = this.fb.nonNullable.group({
    name:        ['', [Validators.required]],
    description: [''],
  });

  constructor() {
    addIcons({ layersOutline, addOutline, closeOutline, createOutline, trashOutline });
    this.load();
  }

  ionViewWillEnter(): void { this.load(); }

  load(event?: Event): void {
    this.loading.set(true);
    this.categories.list().subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.loading.set(false);
        (event as any)?.target?.complete?.();
      },
      error: () => { this.loading.set(false); (event as any)?.target?.complete?.(); },
    });
  }

  openAdd(): void {
    this.editing.set(null);
    this.form.reset({ name: '', description: '' });
    this.modalOpen.set(true);
  }

  openEdit(c: Category): void {
    this.editing.set(c);
    this.form.reset({ name: c.name, description: c.description ?? '' });
    this.modalOpen.set(true);
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    const target = this.editing();
    const obs = target
      ? this.categories.update(target.id, this.form.getRawValue() as any)
      : this.categories.create(this.form.getRawValue() as any);
    obs.subscribe({
      next: () => {
        this.submitting.set(false);
        this.flash(target ? 'Category updated' : 'Category added', 'success');
        this.modalOpen.set(false);
        this.load();
      },
      error: (err) => {
        this.submitting.set(false);
        this.flash(err?.error?.message || 'Could not save', 'danger');
      },
    });
  }

  async confirmDelete(c: Category): Promise<void> {
    const a = await this.alert.create({
      header: `Remove ${c.name}?`,
      message: 'Products in this category will become uncategorized.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove', role: 'destructive',
          handler: () => {
            this.categories.destroy(c.id).subscribe({
              next: () => { this.flash('Category removed', 'success'); this.load(); },
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
