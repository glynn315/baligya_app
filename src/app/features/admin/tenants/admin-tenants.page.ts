import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon,
  IonBackButton, IonButtons, IonSpinner, IonItem, IonLabel, IonBadge,
  IonSearchbar, IonRefresher, IonRefresherContent, IonList, IonModal,
  IonToggle, ToastController, AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  shieldOutline, checkmarkCircle, banOutline, closeOutline,
  refreshOutline, businessOutline, settingsOutline,
} from 'ionicons/icons';

import { AdminService } from '../../../core/services/admin.service';
import { AdminModuleService } from '../../../core/services/admin-module.service';
import { Module, Tenant, TenantModule } from '../../../core/models/api.models';

@Component({
  selector: 'app-admin-tenants',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon,
    IonBackButton, IonButtons, IonSpinner, IonItem, IonLabel, IonBadge,
    IonSearchbar, IonRefresher, IonRefresherContent, IonList, IonModal,
    IonToggle,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/more"></ion-back-button></ion-buttons>
        <ion-title>Admin — Tenants</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar [(ngModel)]="searchTerm" placeholder="Search by name/email"
                       (ionInput)="searchTerm = $event.detail.value || ''; load()"></ion-searchbar>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="load($event)"><ion-refresher-content></ion-refresher-content></ion-refresher>

      <div class="spinner" *ngIf="loading()"><ion-spinner></ion-spinner></div>

      <div class="empty" *ngIf="!loading() && tenants().length === 0">
        <ion-icon name="business-outline"></ion-icon>
        <p>No tenants found</p>
      </div>

      <ion-list *ngIf="!loading() && tenants().length > 0">
        <ion-item *ngFor="let t of tenants(); trackBy: trackById" button (click)="openEditor(t)">
          <ion-label>
            <h2>{{ t.name }}</h2>
            <p class="email">{{ t.email }}</p>
            <div class="modules">
              <ion-badge *ngFor="let m of (t.modules || [])" [color]="moduleColor(m)">{{ m }}</ion-badge>
              <ion-badge *ngIf="!(t.modules?.length)" color="medium">no modules</ion-badge>
            </div>
          </ion-label>
          <ion-badge slot="end" [color]="statusColor(t.status)">{{ t.status }}</ion-badge>
        </ion-item>
      </ion-list>
    </ion-content>

    <ion-modal [isOpen]="editorOpen()" (didDismiss)="editorOpen.set(false)">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ selected()?.name }}</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="editorOpen.set(false)"><ion-icon name="close-outline" slot="icon-only"></ion-icon></ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding" *ngIf="selected() as t">
          <p class="meta">{{ t.email }}</p>
          <p class="meta">Status: <ion-badge [color]="statusColor(t.status)">{{ t.status }}</ion-badge></p>

          <h3>Modules</h3>
          <p class="hint">Toggle the features this tenant can access. Modules are registered under <strong>Registered modules</strong>.</p>

          <ion-item *ngFor="let mod of availableModules()">
            <ion-icon *ngIf="mod.icon" [name]="mod.icon" slot="start"></ion-icon>
            <ion-label>
              <h3>{{ mod.display_name }}</h3>
              <p *ngIf="mod.description">{{ mod.description }}</p>
              <p *ngIf="!mod.description"><code>{{ mod.name }}</code></p>
            </ion-label>
            <ion-toggle slot="end" [checked]="hasModule(mod.name)" (ionChange)="setModule(mod.name, $event.detail.checked)"></ion-toggle>
          </ion-item>
          <p class="hint" *ngIf="availableModules().length === 0">
            No modules registered. Register one first under <strong>Dev → Registered modules</strong>.
          </p>

          <ion-button expand="block" class="ion-margin-top" (click)="save()" [disabled]="saving()">
            <ion-spinner *ngIf="saving()" name="dots" slot="start"></ion-spinner>
            Save modules
          </ion-button>

          <h3 class="ion-margin-top">Actions</h3>
          <ion-button *ngIf="t.status !== 'verified'" expand="block" color="success" (click)="verify(t)">
            <ion-icon name="checkmark-circle" slot="start"></ion-icon> Verify tenant
          </ion-button>
          <ion-button *ngIf="t.status === 'verified'" expand="block" color="danger" fill="outline" (click)="suspend(t)">
            <ion-icon name="ban-outline" slot="start"></ion-icon> Suspend tenant
          </ion-button>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .spinner { display: flex; justify-content: center; padding: 40px; }
    .empty { text-align: center; padding: 60px 24px; color: var(--ion-color-medium); }
    .empty ion-icon { font-size: 60px; margin-bottom: 12px; }
    .email { color: var(--ion-color-medium); font-size: 13px; }
    .modules { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px; }
    .modules ion-badge { font-size: 11px; text-transform: uppercase; }
    .meta { margin: 4px 0; color: var(--ion-color-medium); }
    .hint { color: var(--ion-color-medium); font-size: 13px; margin: 0 0 8px; }
  `],
})
export class AdminTenantsPage {
  private readonly api = inject(AdminService);
  private readonly modulesApi = inject(AdminModuleService);
  private readonly toast = inject(ToastController);
  private readonly alert = inject(AlertController);

  readonly loading = signal(true);
  readonly tenants = signal<Tenant[]>([]);
  readonly editorOpen = signal(false);
  readonly selected = signal<Tenant | null>(null);
  readonly saving = signal(false);
  readonly availableModules = signal<Module[]>([]);

  searchTerm = '';
  draftModules: TenantModule[] = [];

  constructor() {
    addIcons({
      shieldOutline, checkmarkCircle, banOutline, closeOutline,
      refreshOutline, businessOutline, settingsOutline,
    });
    this.load();
    this.loadModules();
  }

  ionViewWillEnter(): void { this.load(); this.loadModules(); }

  private loadModules(): void {
    this.modulesApi.list(true).subscribe({
      next: (res) => this.availableModules.set(res.data ?? []),
      error: () => { /* silently fail — the editor will show "no modules" hint */ },
    });
  }

  load(event?: Event): void {
    this.loading.set(true);
    this.api.listTenants({ search: this.searchTerm || undefined, per_page: 50 }).subscribe({
      next: (res) => {
        this.tenants.set(res.data ?? []);
        this.loading.set(false);
        (event as any)?.target?.complete?.();
      },
      error: (err) => {
        this.loading.set(false);
        (event as any)?.target?.complete?.();
        this.flash(err?.error?.message || 'Could not load tenants', 'danger');
      },
    });
  }

  openEditor(t: Tenant): void {
    this.selected.set(t);
    this.draftModules = [...(t.modules ?? [])];
    this.editorOpen.set(true);
  }

  hasModule(m: TenantModule): boolean {
    return this.draftModules.includes(m);
  }

  setModule(m: TenantModule, on: boolean): void {
    this.draftModules = on
      ? [...new Set([...this.draftModules, m])]
      : this.draftModules.filter((x) => x !== m);
  }

  save(): void {
    const t = this.selected();
    if (!t) return;
    this.saving.set(true);
    this.api.updateModules(t.id, this.draftModules).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.editorOpen.set(false);
        this.flash('Modules updated', 'success');
        // Patch in-memory list so the badge updates without a full reload
        this.tenants.update((list) => list.map((x) => x.id === t.id
          ? { ...x, modules: res.data?.modules ?? this.draftModules }
          : x));
      },
      error: (err) => {
        this.saving.set(false);
        this.flash(err?.error?.message || 'Could not save modules', 'danger');
      },
    });
  }

  async verify(t: Tenant): Promise<void> {
    const a = await this.alert.create({
      header: `Verify ${t.name}?`,
      message: 'This will let the tenant log in and access their store.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Verify', handler: () => this.doVerify(t) },
      ],
    });
    a.present();
  }

  private doVerify(t: Tenant): void {
    this.api.verifyTenant(t.id).subscribe({
      next: (res) => {
        this.flash('Tenant verified', 'success');
        this.editorOpen.set(false);
        this.tenants.update((list) => list.map((x) => x.id === t.id ? { ...x, ...res.data } : x));
      },
      error: (err) => this.flash(err?.error?.message || 'Could not verify', 'danger'),
    });
  }

  async suspend(t: Tenant): Promise<void> {
    const a = await this.alert.create({
      header: `Suspend ${t.name}?`,
      message: 'The tenant will be locked out until you re-verify.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Suspend', role: 'destructive', handler: () => this.doSuspend(t) },
      ],
    });
    a.present();
  }

  private doSuspend(t: Tenant): void {
    this.api.suspendTenant(t.id).subscribe({
      next: (res) => {
        this.flash('Tenant suspended', 'success');
        this.editorOpen.set(false);
        this.tenants.update((list) => list.map((x) => x.id === t.id ? { ...x, ...res.data } : x));
      },
      error: (err) => this.flash(err?.error?.message || 'Could not suspend', 'danger'),
    });
  }

  moduleColor(m: string): string {
    return m === 'eatery' ? 'tertiary' : 'primary';
  }

  statusColor(s: string): string {
    if (s === 'verified') return 'success';
    if (s === 'suspended' || s === 'banned') return 'danger';
    return 'warning';
  }

  trackById = (_: number, t: Tenant) => t.id;

  private async flash(message: string, color: 'success' | 'danger' | 'warning') {
    const t = await this.toast.create({ message, duration: 1800, color, position: 'top' });
    t.present();
  }
}
