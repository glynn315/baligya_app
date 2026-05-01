import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonSearchbar, IonIcon,
  IonRefresher, IonRefresherContent, IonFab, IonFabButton,
  IonSkeletonText, IonModal, IonInput, IonTextarea, IonSelect, IonSelectOption,
  IonButton, IonSpinner, AlertController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cubeOutline, addOutline, layersOutline, searchOutline, alertCircleOutline,
  closeOutline, createOutline, archiveOutline, pricetagOutline, cashOutline,
  trendingUpOutline, trashOutline,
} from 'ionicons/icons';

import { ProductService, CategoryService } from '../../core/services/product.service';
import { InventoryService } from '../../core/services/expense.service';
import { Category, Product } from '../../core/models/api.models';
import { PesoPipe } from '../../shared/pipes/peso.pipe';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, PesoPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonSearchbar, IonIcon,
    IonRefresher, IonRefresherContent, IonFab, IonFabButton,
    IonSkeletonText, IonModal, IonInput, IonTextarea, IonSelect, IonSelectOption,
    IonButton, IonSpinner,
  ],
  templateUrl: './products.page.html',
  styleUrls: ['./products.page.scss'],
})
export class ProductsPage {
  private readonly products = inject(ProductService);
  private readonly categories = inject(CategoryService);
  private readonly inventory = inject(InventoryService);
  private readonly fb = inject(FormBuilder);
  private readonly alert = inject(AlertController);
  private readonly toast = inject(ToastController);

  readonly loading = signal(true);
  readonly items = signal<Product[]>([]);
  readonly cats = signal<Category[]>([]);
  readonly search = signal('');
  readonly activeCat = signal<number | null>(null);

  // Modal state
  readonly editing = signal<Product | null>(null);
  readonly modalOpen = signal(false);
  readonly submitting = signal(false);
  readonly restockOpen = signal(false);
  readonly restockTarget = signal<Product | null>(null);
  readonly restockQty = signal<number>(0);
  readonly restockNotes = signal<string>('');

  readonly form = this.fb.nonNullable.group({
    name:           ['', [Validators.required, Validators.maxLength(150)]],
    category_id:    [null as number | null],
    sku:            [''],
    barcode:        [''],
    price:          [0, [Validators.required, Validators.min(0)]],
    cost_price:     [0, [Validators.min(0)]],
    stock_quantity: [0, [Validators.min(0)]],
    reorder_level:  [5, [Validators.min(0)]],
    description:    [''],
    is_active:      [true],
  });

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const cat = this.activeCat();
    return this.items().filter((p) => {
      if (cat && p.category_id !== cat) return false;
      if (q) {
        const hay = `${p.name} ${p.sku ?? ''} ${p.barcode ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  });

  constructor() {
    addIcons({
      cubeOutline, addOutline, layersOutline, searchOutline, alertCircleOutline,
      closeOutline, createOutline, archiveOutline, pricetagOutline, cashOutline,
      trendingUpOutline, trashOutline,
    });
    this.load();
  }

  ionViewWillEnter(): void { this.load(); }

  load(event?: Event): void {
    this.loading.set(true);
    this.products.pricelist().subscribe({
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
    this.categories.list().subscribe({
      next: (res) => this.cats.set(res.data ?? []),
    });
  }

  setCat(id: number | null): void { this.activeCat.set(id); }

  // ── Add / Edit ────────────────────────────────────────
  openAdd(): void {
    this.editing.set(null);
    this.form.reset({
      name: '', category_id: null, sku: '', barcode: '',
      price: 0, cost_price: 0, stock_quantity: 0, reorder_level: 5,
      description: '', is_active: true,
    });
    this.modalOpen.set(true);
  }

  openEdit(p: Product): void {
    this.editing.set(p);
    this.form.reset({
      name: p.name,
      category_id: p.category_id ?? null,
      sku: p.sku ?? '',
      barcode: p.barcode ?? '',
      price: Number(p.price),
      cost_price: Number(p.cost_price),
      stock_quantity: p.stock_quantity,
      reorder_level: p.reorder_level,
      description: p.description ?? '',
      is_active: p.is_active,
    });
    this.modalOpen.set(true);
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const payload = this.form.getRawValue() as any;
    this.submitting.set(true);
    const target = this.editing();
    const obs = target
      ? this.products.update(target.id, payload)
      : this.products.create(payload);
    obs.subscribe({
      next: () => {
        this.submitting.set(false);
        this.flash(target ? 'Product updated' : 'Product added', 'success');
        this.modalOpen.set(false);
        this.load();
      },
      error: (err) => {
        this.submitting.set(false);
        const errors = err?.error?.errors as Record<string, string[]> | undefined;
        const first = errors ? ([] as string[]).concat(...Object.values(errors))[0] : null;
        this.flash(first || err?.error?.message || 'Could not save product', 'danger');
      },
    });
  }

  async confirmDelete(p: Product): Promise<void> {
    const a = await this.alert.create({
      header: `Remove ${p.name}?`,
      message: 'You can re-add it later, but past sales reports will keep referencing it.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove', role: 'destructive',
          handler: () => {
            this.products.destroy(p.id).subscribe({
              next: () => { this.flash('Product removed', 'success'); this.load(); },
              error: (err) => this.flash(err?.error?.message || 'Could not remove', 'danger'),
            });
          },
        },
      ],
    });
    a.present();
  }

  // ── Restock ──────────────────────────────────────────
  openRestock(p: Product): void {
    this.restockTarget.set(p);
    this.restockQty.set(0);
    this.restockNotes.set('');
    this.restockOpen.set(true);
  }

  saveRestock(): void {
    const target = this.restockTarget();
    const qty = Number(this.restockQty());
    if (!target || !qty) {
      this.flash('Enter a positive quantity', 'danger');
      return;
    }
    this.submitting.set(true);
    this.inventory.adjust({
      product_id: target.id,
      quantity_change: qty, // positive → restock; negative → reduce
      notes: this.restockNotes() || undefined,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.flash(`Stock adjusted by ${qty > 0 ? '+' : ''}${qty}`, 'success');
        this.restockOpen.set(false);
        this.load();
      },
      error: (err) => {
        this.submitting.set(false);
        this.flash(err?.error?.message || 'Could not adjust stock', 'danger');
      },
    });
  }

  private async flash(message: string, color: 'success' | 'danger') {
    const t = await this.toast.create({ message, duration: 1800, color, position: 'top' });
    t.present();
  }
}
