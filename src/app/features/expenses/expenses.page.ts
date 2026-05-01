import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonRefresher, IonRefresherContent,
  IonIcon, IonSkeletonText, IonFab, IonFabButton, IonModal, IonInput, IonSelect,
  IonSelectOption, IonButton, IonSpinner, IonButtons, IonBackButton,
  IonTextarea, ToastController, AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  walletOutline, addOutline, closeOutline, calendarOutline, cashOutline,
  pricetagOutline, documentTextOutline, arrowBackOutline,
} from 'ionicons/icons';

import { ExpenseService } from '../../core/services/expense.service';
import { Expense } from '../../core/models/api.models';
import { PesoPipe } from '../../shared/pipes/peso.pipe';

const CATEGORIES = ['Rent','Utilities','Salaries','Supplies','Inventory','Marketing','Transportation','Other'];

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [
    CommonModule, DatePipe, ReactiveFormsModule, PesoPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonRefresher, IonRefresherContent,
    IonIcon, IonSkeletonText, IonFab, IonFabButton, IonModal, IonInput, IonSelect,
    IonSelectOption, IonButton, IonSpinner, IonButtons, IonBackButton,
    IonTextarea,
  ],
  templateUrl: './expenses.page.html',
  styleUrls: ['./expenses.page.scss'],
})
export class ExpensesPage {
  private readonly expenses = inject(ExpenseService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastController);
  private readonly alert = inject(AlertController);

  readonly loading = signal(true);
  readonly items = signal<Expense[]>([]);
  readonly modalOpen = signal(false);
  readonly submitting = signal(false);
  readonly editing = signal<Expense | null>(null);

  readonly categories = CATEGORIES;
  readonly total = computed(() =>
    this.items().reduce((sum, e) => sum + Number(e.amount || 0), 0),
  );

  readonly form = this.fb.nonNullable.group({
    category: ['Other', [Validators.required]],
    amount:   [0, [Validators.required, Validators.min(0.01)]],
    expense_date: [new Date().toISOString().slice(0, 10), [Validators.required]],
    description: [''],
  });

  constructor() {
    addIcons({
      walletOutline, addOutline, closeOutline, calendarOutline, cashOutline,
      pricetagOutline, documentTextOutline, arrowBackOutline,
    });
    this.load();
  }

  ionViewWillEnter(): void { this.load(); }

  load(event?: Event): void {
    this.loading.set(true);
    this.expenses.list({ per_page: 50 }).subscribe({
      next: (res: any) => {
        const data = res?.data?.data ?? res?.data ?? [];
        this.items.set(Array.isArray(data) ? data : []);
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
      category: 'Other',
      amount: 0,
      expense_date: new Date().toISOString().slice(0, 10),
      description: '',
    });
    this.modalOpen.set(true);
  }

  openEdit(e: Expense): void {
    this.editing.set(e);
    this.form.reset({
      category: e.category,
      amount: Number(e.amount),
      expense_date: e.expense_date.slice(0, 10),
      description: e.description ?? '',
    });
    this.modalOpen.set(true);
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    const target = this.editing();
    const obs = target
      ? this.expenses.update(target.id, this.form.getRawValue() as any)
      : this.expenses.create(this.form.getRawValue() as any);
    obs.subscribe({
      next: async () => {
        this.submitting.set(false);
        this.flash(target ? 'Expense updated' : 'Expense recorded', 'success');
        this.modalOpen.set(false);
        this.load();
      },
      error: (err) => {
        this.submitting.set(false);
        this.flash(err?.error?.message || 'Could not save expense.', 'danger');
      },
    });
  }

  async confirmDelete(e: Expense): Promise<void> {
    const a = await this.alert.create({
      header: 'Remove expense?',
      message: `${e.category} — ${e.amount}. This cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove', role: 'destructive',
          handler: () => {
            this.expenses.destroy(e.id).subscribe({
              next: () => { this.flash('Expense removed', 'success'); this.load(); },
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
