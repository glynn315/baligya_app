import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent, IonInput, IonButton, IonIcon, IonSegment, IonSegmentButton,
  IonLabel, IonSpinner, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  mailOutline, lockClosedOutline, eyeOutline, eyeOffOutline, keypadOutline,
  arrowForwardOutline,
} from 'ionicons/icons';

import { AuthService } from '../../../core/services/auth.service';
import { BrandHeaderComponent } from '../../../shared/components/brand-header.component';

type Mode = 'password' | 'pin';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink, BrandHeaderComponent,
    IonContent, IonInput, IonButton, IonIcon,
    IonSegment, IonSegmentButton, IonLabel, IonSpinner,
  ],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastController);
  private getDeviceId(): string {
    let deviceId = localStorage.getItem('device_id');

    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('device_id', deviceId);
    }

    return deviceId;
  }
  readonly mode = signal<Mode>('password');
  readonly submitting = signal(false);
  readonly showPassword = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    pin: [''],
  });

  constructor() {
    addIcons({
      mailOutline, lockClosedOutline, eyeOutline, eyeOffOutline,
      keypadOutline, arrowForwardOutline,
    });
  }

  setMode(m: Mode | string | null | undefined): void {
    if (m === 'password' || m === 'pin') this.mode.set(m);
  }

  togglePassword(): void { this.showPassword.update((v) => !v); }

  async submit(): Promise<void> {
    const isPin = this.mode() === 'pin';
    const email = this.form.value.email?.trim() ?? '';
    if (!email || !email.includes('@')) {
      this.form.controls.email.markAsTouched();
      return;
    }
    const password = this.form.value.password ?? '';
    const pin = (this.form.value.pin ?? '').trim();

    if (isPin) {
      if (!/^\d{4,6}$/.test(pin)) return;
    } else if (!password || password.length < 8) {
      return;
    }

    this.submitting.set(true);
    const deviceId = this.getDeviceId();
    const obs = isPin
      ? this.auth.pinLogin({ email, pin, device_name: 'mobile' })
      : this.auth.login({ email, password, device_name: 'mobile', device_id: deviceId });

    obs.subscribe({
      next: () => {
        this.submitting.set(false);
        // Trust auth state, not response shape — service tap has already persisted tokens.
        if (this.auth.isAuthenticated()) {
          this.router.navigateByUrl('/tabs/dashboard', { replaceUrl: true });
        } else {
          this.notify('Login response missing tokens.');
        }
      },
      error: (err) => {
        this.submitting.set(false);
        this.notify(err?.error?.message || 'Unable to sign in. Check your credentials.');
      },
    });
  }

  private async notify(message: string) {
    const t = await this.toast.create({
      message, duration: 2400, color: 'danger', position: 'top',
    });
    t.present();
  }
}
