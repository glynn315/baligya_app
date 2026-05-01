import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonInput, IonTextarea, IonButton, IonSpinner, IonIcon, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  storefrontOutline, callOutline, mailOutline, locationOutline, colorPaletteOutline,
} from 'ionicons/icons';

import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';

@Component({
  selector: 'app-store-settings',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonInput, IonTextarea, IonButton, IonSpinner, IonIcon,
  ],
  template: `
    <ion-header [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/more"></ion-back-button>
        </ion-buttons>
        <ion-title>Store profile</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true">
      <div class="container-tight content-wrap">
        <form [formGroup]="form" (ngSubmit)="save()" class="form">
          <div class="field">
            <ion-input label="Store name" labelPlacement="stacked" formControlName="name">
              <ion-icon slot="start" name="storefront-outline"></ion-icon>
            </ion-input>
          </div>
          <div class="field">
            <ion-input label="Email" labelPlacement="stacked" type="email" inputmode="email" formControlName="email">
              <ion-icon slot="start" name="mail-outline"></ion-icon>
            </ion-input>
          </div>
          <div class="field">
            <ion-input label="Phone" labelPlacement="stacked" type="tel" inputmode="tel" formControlName="phone">
              <ion-icon slot="start" name="call-outline"></ion-icon>
            </ion-input>
          </div>
          <div class="field">
            <ion-textarea label="Address" labelPlacement="stacked" rows="2" autoGrow="true" formControlName="address">
              <ion-icon slot="start" name="location-outline"></ion-icon>
            </ion-textarea>
          </div>
          <div class="field">
            <ion-input label="Brand color (hex)" labelPlacement="stacked" formControlName="primary_color" placeholder="#1FA64D">
              <ion-icon slot="start" name="color-palette-outline"></ion-icon>
            </ion-input>
          </div>

          <ion-button expand="block" class="brand-btn" type="submit" [disabled]="submitting()">
            <ion-spinner *ngIf="submitting()" name="crescent" class="mr-2"></ion-spinner>
            {{ submitting() ? 'Saving…' : 'Save changes' }}
          </ion-button>
        </form>
      </div>
    </ion-content>
  `,
  styles: [`
    .content-wrap { padding: 16px 0 32px; }
    .form { display: flex; flex-direction: column; gap: 12px; }
    .mr-2 { margin-right: 8px; }
  `],
})
export class StorePage {
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);
  private readonly tenant = inject(TenantService);
  private readonly toast = inject(ToastController);

  readonly submitting = signal(false);

  readonly form = this.fb.nonNullable.group({
    name:           [this.auth.tenant()?.name || '', [Validators.required]],
    email:          [this.auth.tenant()?.email || '', [Validators.required, Validators.email]],
    phone:          [this.auth.tenant()?.phone || ''],
    address:        [this.auth.tenant()?.address || ''],
    primary_color:  [this.auth.tenant()?.primary_color || '#1FA64D'],
  });

  constructor() {
    addIcons({ storefrontOutline, callOutline, mailOutline, locationOutline, colorPaletteOutline });
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    this.tenant.update(this.form.getRawValue() as any).subscribe({
      next: async () => {
        this.submitting.set(false);
        const t = await this.toast.create({
          message: 'Store updated', duration: 1600, color: 'success', position: 'top',
        });
        t.present();
      },
      error: async (err) => {
        this.submitting.set(false);
        const t = await this.toast.create({
          message: err?.error?.message || 'Could not update store',
          duration: 2000, color: 'danger', position: 'top',
        });
        t.present();
      },
    });
  }
}
