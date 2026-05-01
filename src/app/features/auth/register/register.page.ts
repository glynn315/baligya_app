import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent, IonInput, IonButton, IonIcon, IonTextarea, IonSpinner,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  storefrontOutline, personOutline, mailOutline, callOutline,
  lockClosedOutline, locationOutline, eyeOutline, eyeOffOutline,
  arrowForwardOutline, arrowBackOutline,
} from 'ionicons/icons';

import { AuthService } from '../../../core/services/auth.service';
import { BrandHeaderComponent } from '../../../shared/components/brand-header.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink, BrandHeaderComponent,
    IonContent, IonInput, IonButton, IonIcon, IonTextarea, IonSpinner,
  ],
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastController);

  readonly submitting = signal(false);
  readonly showPassword = signal(false);

  readonly form = this.fb.nonNullable.group(
    {
      store_name: ['', [Validators.required, Validators.maxLength(150)]],
      owner_name: ['', [Validators.required, Validators.maxLength(100)]],
      email:      ['', [Validators.required, Validators.email]],
      password:   ['', [Validators.required, Validators.minLength(8)]],
      password_confirmation: ['', [Validators.required]],
      phone:      [''],
      address:    [''],
    },
    { validators: [matchPasswords] },
  );

  constructor() {
    addIcons({
      storefrontOutline, personOutline, mailOutline, callOutline,
      lockClosedOutline, locationOutline, eyeOutline, eyeOffOutline,
      arrowForwardOutline, arrowBackOutline,
    });
  }

  togglePassword(): void { this.showPassword.update((v) => !v); }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.auth.register(this.form.getRawValue()).subscribe({
      next: async (res) => {
        this.submitting.set(false);
        if (!res.success) {
          this.notify(res.message || 'Registration failed', 'danger');
          return;
        }
        this.notify('Account created. Please verify your email.', 'success');
        this.router.navigate(['/auth/verify-pending'], { replaceUrl: true });
      },
      error: (err) => {
        this.submitting.set(false);
        const errors = err?.error?.errors as Record<string, string[]> | undefined;
        const first = errors
          ? ([] as string[]).concat(...Object.values(errors))[0]
          : null;
        this.notify(first || err?.error?.message || 'Could not create account.', 'danger');
      },
    });
  }

  private async notify(message: string, color: 'success' | 'danger') {
    const t = await this.toast.create({ message, duration: 2600, color, position: 'top' });
    t.present();
  }
}

function matchPasswords(group: any) {
  const a = group.get('password')?.value;
  const b = group.get('password_confirmation')?.value;
  return a && b && a !== b ? { mismatch: true } : null;
}
