import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle,
  IonContent, IonSearchbar, IonIcon, IonModal, IonSelect, IonSelectOption,
  IonInput, IonButton, IonSpinner, IonRippleEffect, IonRefresher, IonRefresherContent,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  searchOutline, addOutline, removeOutline, closeOutline, cartOutline,
  cashOutline, walletOutline, cardOutline, checkmarkCircle, trashOutline,
  pricetagOutline, qrCodeOutline,
} from 'ionicons/icons';

import { ProductService } from '../../core/services/product.service';
import { SaleService } from '../../core/services/sale.service';
import { CreateSaleDto, PaymentMethod, Product } from '../../core/models/api.models';
import { PesoPipe } from '../../shared/pipes/peso.pipe';

interface CartLine {
  product: Product;
  qty: number;
}

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [
    CommonModule, FormsModule, PesoPipe,
    IonHeader, IonToolbar, IonTitle,
    IonContent, IonSearchbar, IonIcon, IonModal,
    IonInput, IonButton, IonSpinner, IonRippleEffect, IonRefresher, IonRefresherContent,
  ],
  templateUrl: './pos.page.html',
  styleUrls: ['./pos.page.scss'],
})
export class PosPage {
  private readonly productService = inject(ProductService);
  private readonly saleService = inject(SaleService);
  private readonly toast = inject(ToastController);

  readonly loading = signal(true);
  readonly products = signal<Product[]>([]);
  readonly search = signal('');
  readonly cart = signal<CartLine[]>([]);
  readonly checkoutOpen = signal(false);
  readonly cartOpen = signal(false);
  readonly submitting = signal(false);

  // Checkout form state
  readonly paymentMethod = signal<PaymentMethod>('cash');
  readonly amountPaid = signal<number | null>(null);
  readonly discount = signal<number>(0);

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.products();
    return this.products().filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q),
    );
  });

  readonly subtotal = computed(() =>
    this.cart().reduce((sum, l) => sum + l.product.price * l.qty, 0),
  );
  readonly total = computed(() => Math.max(0, this.subtotal() - (this.discount() || 0)));
  readonly itemCount = computed(() =>
    this.cart().reduce((sum, l) => sum + l.qty, 0),
  );
  readonly change = computed(() => {
    const paid = this.amountPaid() ?? 0;
    return Math.max(0, paid - this.total());
  });

  constructor() {
    addIcons({
      searchOutline, addOutline, removeOutline, closeOutline, cartOutline,
      cashOutline, walletOutline, cardOutline, checkmarkCircle, trashOutline,
      pricetagOutline, qrCodeOutline,
    });
    this.load();
  }

  ionViewWillEnter(): void { this.load(); }

  load(event?: Event): void {
    this.loading.set(true);
    this.productService.pricelist().subscribe({
      next: (res) => {
        this.products.set((res.data ?? []).filter((p) => p.is_active));
        this.loading.set(false);
        (event as any)?.target?.complete?.();
      },
      error: () => {
        this.loading.set(false);
        (event as any)?.target?.complete?.();
      },
    });
  }

  add(p: Product): void {
    if (p.is_out_of_stock) {
      this.flash(`${p.name} is out of stock`, 'warning');
      return;
    }
    this.cart.update((lines) => {
      const idx = lines.findIndex((l) => l.product.id === p.id);
      if (idx === -1) return [...lines, { product: p, qty: 1 }];
      const next = [...lines];
      const newQty = next[idx].qty + 1;
      if (newQty > p.stock_quantity) {
        this.flash(`Only ${p.stock_quantity} in stock`, 'warning');
        return next;
      }
      next[idx] = { ...next[idx], qty: newQty };
      return next;
    });
  }

  decrement(line: CartLine): void {
    this.cart.update((lines) => {
      const idx = lines.findIndex((l) => l.product.id === line.product.id);
      if (idx === -1) return lines;
      const next = [...lines];
      next[idx] = { ...next[idx], qty: next[idx].qty - 1 };
      return next.filter((l) => l.qty > 0);
    });
  }

  remove(line: CartLine): void {
    this.cart.update((ls) => ls.filter((l) => l.product.id !== line.product.id));
  }

  clearCart(): void { this.cart.set([]); }

  openCheckout(): void {
    if (this.cart().length === 0) return;
    this.amountPaid.set(this.total());
    this.discount.set(0);
    this.paymentMethod.set('cash');
    this.checkoutOpen.set(true);
  }

  confirm(): void {
    const paid = this.amountPaid() ?? 0;
    if (this.paymentMethod() === 'cash' && paid < this.total()) {
      this.flash('Amount paid is less than total', 'danger');
      return;
    }
    const dto: CreateSaleDto = {
      items: this.cart().map((l) => ({
        product_id: l.product.id,
        quantity: l.qty,
        unit_price: l.product.price,
      })),
      discount_amount: this.discount() || 0,
      amount_paid: paid,
      payment_method: this.paymentMethod(),
    };
    this.submitting.set(true);
    this.saleService.create(dto).subscribe({
      next: (res) => {
        this.submitting.set(false);
        if (!res.success) { this.flash(res.message, 'danger'); return; }
        this.flash(`Sale ${res.data?.transaction_number || ''} completed`, 'success');
        this.cart.set([]);
        this.checkoutOpen.set(false);
        this.cartOpen.set(false);
      },
      error: (err) => {
        this.submitting.set(false);
        this.flash(err?.error?.message || 'Could not complete sale.', 'danger');
      },
    });
  }

  trackById = (_: number, p: Product) => p.id;

  flashSoon(method: string): void {
    this.flash(`${method} payments are coming soon — use cash for now.`, 'warning');
  }

  private async flash(message: string, color: 'success' | 'danger' | 'warning') {
    const t = await this.toast.create({ message, duration: 1800, color, position: 'top' });
    t.present();
  }
}
