import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonRefresher, IonRefresherContent,
  IonIcon, IonSkeletonText, IonFab, IonFabButton, IonModal, IonInput, IonSelect,
  IonSelectOption, IonButton, IonSpinner, IonButtons, IonBackButton, IonToggle,
  AlertController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  peopleOutline, personOutline, mailOutline, lockClosedOutline, keypadOutline,
  addOutline, closeOutline, createOutline, trashOutline, shieldCheckmarkOutline,
} from 'ionicons/icons';

import { EmployeeService } from '../../core/services/employee.service';
import { Employee } from '../../core/models/api.models';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonRefresher, IonRefresherContent,
    IonIcon, IonSkeletonText, IonFab, IonFabButton, IonModal, IonInput, IonSelect,
    IonSelectOption, IonButton, IonSpinner, IonButtons, IonBackButton, IonToggle,
  ],
  templateUrl: './employees.page.html',
  styleUrls: ['./employees.page.scss'],
})
export class EmployeesPage {
  private readonly employees = inject(EmployeeService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastController);
  private readonly alert = inject(AlertController);

  readonly loading = signal(true);
  readonly items = signal<Employee[]>([]);
  readonly modalOpen = signal(false);
  readonly submitting = signal(false);
  readonly editing = signal<Employee | null>(null);

  readonly form = this.fb.nonNullable.group({
    name:     ['', [Validators.required]],
    email:    ['', [Validators.required, Validators.email]],
    role:     ['cashier' as 'manager' | 'cashier'],
    password: ['', [Validators.minLength(8)]],
    password_confirmation: [''],
    pin:      [''],
    is_active: [true],
  });

  constructor() {
    addIcons({
      peopleOutline, personOutline, mailOutline, lockClosedOutline, keypadOutline,
      addOutline, closeOutline, createOutline, trashOutline, shieldCheckmarkOutline,
    });
    this.load();
  }

  ionViewWillEnter(): void { this.load(); }

  load(event?: Event): void {
    this.loading.set(true);
    this.employees.list().subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.loading.set(false);
        (event as any)?.target?.complete?.();
      },
      error: () => {
        this.loading.set(false);
        (event as any)?.target?.complete?.();
      },
    });
  }

  openAdd(): void {
    this.editing.set(null);
    this.form.reset({
      name: '', email: '', role: 'cashier',
      password: '', password_confirmation: '', pin: '', is_active: true,
    });
    this.form.controls.password.addValidators(Validators.required);
    this.form.controls.password.updateValueAndValidity();
    this.modalOpen.set(true);
  }

  openEdit(e: Employee): void {
    this.editing.set(e);
    this.form.reset({
      name: e.name, email: e.email,
      role: (e.role as 'manager' | 'cashier'),
      password: '', password_confirmation: '', pin: '', is_active: e.is_active,
    });
    // Password optional on edit
    this.form.controls.password.clearValidators();
    this.form.controls.password.addValidators(Validators.minLength(8));
    this.form.controls.password.updateValueAndValidity();
    this.modalOpen.set(true);
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const payload = { ...this.form.getRawValue() } as any;
    // Strip empty password fields on edit
    if (this.editing() && !payload.password) {
      delete payload.password;
      delete payload.password_confirmation;
    }
    if (!payload.pin) delete payload.pin;

    this.submitting.set(true);
    const target = this.editing();
    const obs = target
      ? this.employees.update(target.id, payload)
      : this.employees.create(payload);

    obs.subscribe({
      next: () => {
        this.submitting.set(false);
        this.flash(target ? 'Staff updated' : 'Staff added', 'success');
        this.modalOpen.set(false);
        this.load();
      },
      error: (err) => {
        this.submitting.set(false);
        const errors = err?.error?.errors as Record<string, string[]> | undefined;
        const first = errors ? ([] as string[]).concat(...Object.values(errors))[0] : null;
        this.flash(first || err?.error?.message || 'Could not save staff', 'danger');
      },
    });
  }

  async confirmDelete(e: Employee): Promise<void> {
    const a = await this.alert.create({
      header: `Remove ${e.name}?`,
      message: 'They will lose access to this store.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove', role: 'destructive',
          handler: () => {
            this.employees.destroy(e.id).subscribe({
              next: () => { this.flash('Staff removed', 'success'); this.load(); },
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
