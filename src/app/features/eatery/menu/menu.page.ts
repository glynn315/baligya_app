import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon,
  IonBackButton, IonButtons, IonSpinner, IonModal, IonInput, IonItem,
  IonLabel, IonSearchbar, IonToggle, IonRefresher, IonRefresherContent,
  ToastController, IonList, IonItemSliding, IonItemOptions, IonItemOption,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline, createOutline, trashOutline, restaurantOutline, closeOutline,
  searchOutline, checkmarkCircle,
} from 'ionicons/icons';

import { MenuItemService } from '../../../core/services/menu-item.service';
import { MenuItem } from '../../../core/models/api.models';

@Component({
  selector: 'app-eatery-menu',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon,
    IonBackButton, IonButtons, IonSpinner, IonModal, IonInput, IonItem,
    IonLabel, IonSearchbar, IonToggle, IonRefresher, IonRefresherContent,
    IonList, IonItemSliding, IonItemOptions, IonItemOption,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/dashboard"></ion-back-button></ion-buttons>
        <ion-title>Menu</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="openCreate()"><ion-icon name="add-outline" slot="icon-only"></ion-icon></ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar [(ngModel)]="searchTerm" placeholder="Search menu" (ionInput)="searchTerm = $event.detail.value || ''"></ion-searchbar>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="load($event)"><ion-refresher-content></ion-refresher-content></ion-refresher>

      <div class="spinner" *ngIf="loading()"><ion-spinner></ion-spinner></div>

      <div class="empty" *ngIf="!loading() && filtered().length === 0">
        <ion-icon name="restaurant-outline"></ion-icon>
        <p>No menu items found</p>
        <ion-button (click)="openCreate()"><ion-icon name="add-outline" slot="start"></ion-icon> Add item</ion-button>
      </div>

      <ion-list *ngIf="!loading() && filtered().length > 0">
        <ion-item-sliding *ngFor="let m of filtered(); trackBy: trackById">
          <ion-item button (click)="openEdit(m)">
            <ion-label>
              <h3>{{ m.name }} <small *ngIf="!m.availability" class="unavail">(unavailable)</small></h3>
              <p>{{ m.category || 'Uncategorized' }}</p>
            </ion-label>
            <div slot="end" class="price">₱ {{ m.price | number:'1.2-2' }}</div>
          </ion-item>
          <ion-item-options side="end">
            <ion-item-option color="danger" (click)="remove(m)">
              <ion-icon name="trash-outline" slot="icon-only"></ion-icon>
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>
    </ion-content>

    <ion-modal [isOpen]="formOpen()" (didDismiss)="formOpen.set(false)">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ editing() ? 'Edit Item' : 'New Item' }}</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="formOpen.set(false)"><ion-icon name="close-outline" slot="icon-only"></ion-icon></ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <ion-item>
            <ion-label position="stacked">Name *</ion-label>
            <ion-input [(ngModel)]="form.name"></ion-input>
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Price *</ion-label>
            <ion-input type="number" inputmode="decimal" [(ngModel)]="form.price"></ion-input>
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Category</ion-label>
            <ion-input [(ngModel)]="form.category" placeholder="e.g. Main, Drinks, Snacks"></ion-input>
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Description</ion-label>
            <ion-input [(ngModel)]="form.description"></ion-input>
          </ion-item>
          <ion-item>
            <ion-label>Available</ion-label>
            <ion-toggle [(ngModel)]="form.availability"></ion-toggle>
          </ion-item>

          <ion-button expand="block" class="ion-margin-top" (click)="save()" [disabled]="saving()">
            <ion-spinner *ngIf="saving()" name="dots" slot="start"></ion-spinner>
            {{ editing() ? 'Update' : 'Create' }}
          </ion-button>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .spinner { display: flex; justify-content: center; padding: 40px; }
    .empty { text-align: center; padding: 60px 24px; color: var(--ion-color-medium); }
    .empty ion-icon { font-size: 60px; margin-bottom: 12px; }
    .price { font-weight: 700; color: var(--tenant-primary, #3880ff); }
    .unavail { color: var(--ion-color-danger); font-weight: 600; }
  `],
})
export class EateryMenuPage {
  private readonly api = inject(MenuItemService);
  private readonly toast = inject(ToastController);

  readonly loading = signal(true);
  readonly items = signal<MenuItem[]>([]);
  readonly formOpen = signal(false);
  readonly editing = signal<MenuItem | null>(null);
  readonly saving = signal(false);

  searchTerm = '';
  form: any = { name: '', price: 0, category: '', description: '', availability: true };

  readonly filtered = computed(() => {
    const q = this.searchTerm.trim().toLowerCase();
    if (!q) return this.items();
    return this.items().filter((m) =>
      m.name.toLowerCase().includes(q) ||
      (m.category || '').toLowerCase().includes(q),
    );
  });

  constructor() {
    addIcons({
      addOutline, createOutline, trashOutline, restaurantOutline, closeOutline,
      searchOutline, checkmarkCircle,
    });
    this.load();
  }

  ionViewWillEnter(): void { this.load(); }

  load(event?: Event): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.loading.set(false);
        (event as any)?.target?.complete?.();
      },
      error: () => {
        this.loading.set(false);
        (event as any)?.target?.complete?.();
        this.flash('Could not load menu', 'danger');
      },
    });
  }

  openCreate(): void {
    this.editing.set(null);
    this.form = { name: '', price: 0, category: '', description: '', availability: true };
    this.formOpen.set(true);
  }

  openEdit(m: MenuItem): void {
    this.editing.set(m);
    this.form = {
      name: m.name,
      price: m.price,
      category: m.category || '',
      description: m.description || '',
      availability: m.availability,
    };
    this.formOpen.set(true);
  }

  save(): void {
    if (!this.form.name?.trim()) {
      this.flash('Name is required', 'warning');
      return;
    }
    if (this.form.price == null || this.form.price < 0) {
      this.flash('Price must be a positive number', 'warning');
      return;
    }
    this.saving.set(true);
    const obs = this.editing()
      ? this.api.update(this.editing()!.menu_item_id, this.form)
      : this.api.create(this.form);
    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.flash(this.editing() ? 'Item updated' : 'Item created', 'success');
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.flash(err?.error?.message || 'Could not save', 'danger');
      },
    });
  }

  remove(m: MenuItem): void {
    if (!confirm(`Delete ${m.name}?`)) return;
    this.api.delete(m.menu_item_id).subscribe({
      next: () => { this.flash('Item deleted', 'success'); this.load(); },
      error: (err) => this.flash(err?.error?.message || 'Could not delete', 'danger'),
    });
  }

  trackById = (_: number, m: MenuItem) => m.menu_item_id;

  private async flash(message: string, color: 'success' | 'danger' | 'warning') {
    const t = await this.toast.create({ message, duration: 1800, color, position: 'top' });
    t.present();
  }
}
