import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon,
  IonBackButton, IonButtons, IonSpinner, IonItem, IonLabel, IonBadge,
  IonRefresher, IonRefresherContent, IonList, IonItemSliding, IonItemOptions,
  IonItemOption, IonModal, IonInput, IonTextarea, IonToggle, IonNote,
  ToastController, AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline, createOutline, trashOutline, closeOutline, refreshOutline,
  shieldOutline, gridOutline, checkmarkCircle,
} from 'ionicons/icons';

import { AdminModuleService } from '../../../core/services/admin-module.service';
import { Module } from '../../../core/models/api.models';

@Component({
  selector: 'app-admin-modules',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon,
    IonBackButton, IonButtons, IonSpinner, IonItem, IonLabel, IonBadge,
    IonRefresher, IonRefresherContent, IonList, IonItemSliding, IonItemOptions,
    IonItemOption, IonModal, IonInput, IonTextarea, IonToggle, IonNote,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/more"></ion-back-button></ion-buttons>
        <ion-title>Modules</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="openCreate()"><ion-icon name="add-outline" slot="icon-only"></ion-icon></ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="load($event)"><ion-refresher-content></ion-refresher-content></ion-refresher>

      <div class="spinner" *ngIf="loading()"><ion-spinner></ion-spinner></div>

      <div class="empty" *ngIf="!loading() && modules().length === 0">
        <ion-icon name="grid-outline"></ion-icon>
        <p>No modules registered yet.</p>
        <ion-button (click)="openCreate()">
          <ion-icon name="add-outline" slot="start"></ion-icon> Register module
        </ion-button>
      </div>

      <p class="hint" *ngIf="!loading() && modules().length > 0">
        Modules registered here can be assigned to tenants. The slug
        (lowercase, no spaces) is used by route middleware — once a module is
        in use, don't delete it; disable it instead.
      </p>

      <ion-list *ngIf="!loading() && modules().length > 0">
        <ion-item-sliding *ngFor="let m of modules(); trackBy: trackById">
          <ion-item button (click)="openEdit(m)">
            <ion-icon *ngIf="m.icon" [name]="m.icon" slot="start"></ion-icon>
            <ion-label>
              <h2>{{ m.display_name }} <ion-badge *ngIf="!m.is_active" color="medium">disabled</ion-badge></h2>
              <p><code>{{ m.name }}</code></p>
              <p *ngIf="m.description" class="desc">{{ m.description }}</p>
            </ion-label>
            <ion-note slot="end">#{{ m.sort_order }}</ion-note>
          </ion-item>
          <ion-item-options side="end">
            <ion-item-option color="danger" (click)="askDelete(m)">
              <ion-icon name="trash-outline" slot="icon-only"></ion-icon>
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>
    </ion-content>

    <!-- Create / edit modal -->
    <ion-modal [isOpen]="formOpen()" (didDismiss)="formOpen.set(false)">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ editing() ? 'Edit module' : 'Register module' }}</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="formOpen.set(false)"><ion-icon name="close-outline" slot="icon-only"></ion-icon></ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <ion-item>
            <ion-label position="stacked">Slug *</ion-label>
            <ion-input [(ngModel)]="form.name" [disabled]="!!editing()"
                       placeholder="e.g. delivery, kiosk, reservations"></ion-input>
            <ion-note slot="helper">Lowercase letters, digits, underscores. Used by routes — immutable after creation.</ion-note>
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Display name *</ion-label>
            <ion-input [(ngModel)]="form.display_name" placeholder="e.g. Delivery"></ion-input>
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Description</ion-label>
            <ion-textarea [(ngModel)]="form.description" rows="2"></ion-textarea>
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Icon (ionicon name)</ion-label>
            <ion-input [(ngModel)]="form.icon" placeholder="e.g. bicycle-outline"></ion-input>
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Sort order</ion-label>
            <ion-input type="number" [(ngModel)]="form.sort_order"></ion-input>
          </ion-item>
          <ion-item>
            <ion-label>Active</ion-label>
            <ion-toggle slot="end" [(ngModel)]="form.is_active"></ion-toggle>
          </ion-item>

          <ion-button expand="block" class="ion-margin-top" (click)="save()" [disabled]="saving()">
            <ion-spinner *ngIf="saving()" name="dots" slot="start"></ion-spinner>
            {{ editing() ? 'Save' : 'Register' }}
          </ion-button>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .spinner { display: flex; justify-content: center; padding: 40px; }
    .empty { text-align: center; padding: 60px 24px; color: var(--ion-color-medium); }
    .empty ion-icon { font-size: 60px; margin-bottom: 12px; }
    .hint { padding: 14px 18px 4px; color: var(--ion-color-medium); font-size: 13px; }
    .desc { white-space: normal !important; color: var(--ion-color-medium); }
    code { background: var(--ion-color-light); padding: 2px 6px; border-radius: 4px; font-size: 12px; }
  `],
})
export class AdminModulesPage {
  private readonly api = inject(AdminModuleService);
  private readonly toast = inject(ToastController);
  private readonly alert = inject(AlertController);

  readonly loading = signal(true);
  readonly modules = signal<Module[]>([]);
  readonly formOpen = signal(false);
  readonly editing = signal<Module | null>(null);
  readonly saving = signal(false);

  form: any = this.blankForm();

  constructor() {
    addIcons({
      addOutline, createOutline, trashOutline, closeOutline, refreshOutline,
      shieldOutline, gridOutline, checkmarkCircle,
    });
    this.load();
  }

  ionViewWillEnter(): void { this.load(); }

  load(event?: Event): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (res) => {
        this.modules.set(res.data ?? []);
        this.loading.set(false);
        (event as any)?.target?.complete?.();
      },
      error: (err) => {
        this.loading.set(false);
        (event as any)?.target?.complete?.();
        this.flash(err?.error?.message || 'Could not load modules', 'danger');
      },
    });
  }

  openCreate(): void {
    this.editing.set(null);
    this.form = this.blankForm();
    this.formOpen.set(true);
  }

  openEdit(m: Module): void {
    this.editing.set(m);
    this.form = {
      name: m.name,
      display_name: m.display_name,
      description: m.description || '',
      icon: m.icon || '',
      sort_order: m.sort_order,
      is_active: m.is_active,
    };
    this.formOpen.set(true);
  }

  save(): void {
    if (!this.editing() && (!this.form.name?.trim() || !/^[a-z][a-z0-9_]*$/.test(this.form.name))) {
      this.flash('Slug must be lowercase letters/digits/underscores and start with a letter.', 'warning');
      return;
    }
    if (!this.form.display_name?.trim()) {
      this.flash('Display name is required', 'warning');
      return;
    }
    this.saving.set(true);
    const obs = this.editing()
      ? this.api.update(this.editing()!.module_id, {
          display_name: this.form.display_name,
          description: this.form.description || null,
          icon: this.form.icon || null,
          is_active: this.form.is_active,
          sort_order: Number(this.form.sort_order) || 0,
        })
      : this.api.create({
          name: this.form.name.trim().toLowerCase(),
          display_name: this.form.display_name,
          description: this.form.description || null,
          icon: this.form.icon || null,
          is_active: this.form.is_active,
          sort_order: Number(this.form.sort_order) || 0,
        });

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.flash(this.editing() ? 'Module updated' : 'Module registered', 'success');
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.flash(err?.error?.message || 'Could not save', 'danger');
      },
    });
  }

  async askDelete(m: Module): Promise<void> {
    const a = await this.alert.create({
      header: `Delete '${m.name}'?`,
      message: 'Tenants who already have this module enabled will keep it. ' +
               'Choose "Delete & detach" to also remove it from every tenant.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Delete', handler: () => this.doDelete(m, false) },
        { text: 'Delete & detach', role: 'destructive', handler: () => this.doDelete(m, true) },
      ],
    });
    a.present();
  }

  private doDelete(m: Module, detach: boolean): void {
    this.api.delete(m.module_id, detach).subscribe({
      next: () => {
        this.flash(detach ? 'Module deleted and detached' : 'Module deleted', 'success');
        this.load();
      },
      error: (err) => this.flash(err?.error?.message || 'Could not delete', 'danger'),
    });
  }

  trackById = (_: number, m: Module) => m.module_id;

  private blankForm() {
    return { name: '', display_name: '', description: '', icon: '', sort_order: 0, is_active: true };
  }

  private async flash(message: string, color: 'success' | 'danger' | 'warning') {
    const t = await this.toast.create({ message, duration: 1800, color, position: 'top' });
    t.present();
  }
}
