import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon,
  IonBackButton, IonButtons, IonSpinner, IonModal, IonInput, IonItem,
  IonLabel, IonSearchbar, IonFooter, IonBadge, ToastController, IonRippleEffect,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline, removeOutline, cartOutline, cashOutline, closeOutline,
  checkmarkCircle, restaurantOutline, printOutline, trashOutline,
  arrowBack, banOutline,
} from 'ionicons/icons';

import { RestaurantTableService } from '../../../core/services/restaurant-table.service';
import { MenuItemService } from '../../../core/services/menu-item.service';
import { OrderService } from '../../../core/services/order.service';
import { EateryPaymentService, OfflineCreatePaymentDto } from '../../../core/services/eatery-payment.service';
import {
  CreateOrderDto, MenuItem, Order, Payment, RestaurantTable,
} from '../../../core/models/api.models';

interface CartLine { item: MenuItem; qty: number; }

@Component({
  selector: 'app-eatery-table-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon,
    IonBackButton, IonButtons, IonSpinner, IonModal, IonInput, IonItem,
    IonLabel, IonSearchbar, IonFooter, IonBadge, IonRippleEffect,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/eatery/tables"></ion-back-button></ion-buttons>
        <ion-title>{{ table()?.label || 'Table ' + (table()?.table_number || '...') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="spinner" *ngIf="loading()"><ion-spinner></ion-spinner></div>

      <ng-container *ngIf="!loading() && table()">
        <div class="header-bar">
          <div>
            <div class="status" [class]="derivedStatus()">{{ derivedStatusLabel() }}</div>
          </div>
          <div class="total" *ngIf="activeOrder()">
            <div class="label">Current bill</div>
            <div class="amount">₱ {{ activeOrder()!.total_amount | number:'1.2-2' }}</div>
          </div>
        </div>

        <!-- Active order summary -->
        <div class="active-order" *ngIf="activeOrder() as o">
          <h3>Order {{ o.order_number }} <ion-badge color="warning">{{ o.payment_status }}</ion-badge></h3>
          <div class="line" *ngFor="let it of o.items">
            <span>{{ it.quantity }} × {{ it.item_name }}</span>
            <span>₱ {{ it.subtotal | number:'1.2-2' }}</span>
          </div>
          <div class="line total-line">
            <strong>TOTAL</strong>
            <strong>₱ {{ o.total_amount | number:'1.2-2' }}</strong>
          </div>
          <div class="actions">
            <ion-button expand="block" (click)="openItemPicker()">
              <ion-icon name="add-outline" slot="start"></ion-icon>
              Add items
            </ion-button>
            <ion-button expand="block" color="success" (click)="openPay()">
              <ion-icon name="cash-outline" slot="start"></ion-icon>
              Pay ₱ {{ o.total_amount | number:'1.2-2' }}
            </ion-button>
            <ion-button expand="block" color="medium" fill="outline" (click)="cancelOrder()">
              <ion-icon name="ban-outline" slot="start"></ion-icon>
              Cancel order
            </ion-button>
          </div>
        </div>

        <!-- No active order: show "Start order" CTA -->
        <div class="cta" *ngIf="!activeOrder()">
          <ion-icon name="restaurant-outline"></ion-icon>
          <p>No active order at this table.</p>
          <ion-button expand="block" (click)="openItemPicker()">
            <ion-icon name="cart-outline" slot="start"></ion-icon>
            Start an order
          </ion-button>
        </div>
      </ng-container>
    </ion-content>

    <!-- Menu picker modal -->
    <ion-modal [isOpen]="pickerOpen()" (didDismiss)="pickerOpen.set(false)">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>Add items</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="pickerOpen.set(false)"><ion-icon name="close-outline" slot="icon-only"></ion-icon></ion-button>
            </ion-buttons>
          </ion-toolbar>
          <ion-toolbar>
            <ion-searchbar [(ngModel)]="searchTerm" (ionInput)="searchTerm = $event.detail.value || ''" placeholder="Search menu"></ion-searchbar>
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <div class="menu-grid">
            <div *ngFor="let m of filteredMenu(); trackBy: trackMenu" class="menu-card ion-activatable"
                 [class.unavail]="!m.availability" (click)="addToCart(m)">
              <ion-ripple-effect></ion-ripple-effect>
              <div class="name">{{ m.name }}</div>
              <div class="cat">{{ m.category }}</div>
              <div class="price">₱ {{ m.price | number:'1.2-2' }}</div>
              <div class="unavail-tag" *ngIf="!m.availability">N/A</div>
            </div>
          </div>
        </ion-content>
        <ion-footer *ngIf="cart().length > 0">
          <div class="cart">
            <div class="cart-line" *ngFor="let line of cart()">
              <div class="line-name">{{ line.item.name }}</div>
              <div class="line-controls">
                <ion-button size="small" fill="clear" (click)="dec(line)"><ion-icon name="remove-outline" slot="icon-only"></ion-icon></ion-button>
                <span>{{ line.qty }}</span>
                <ion-button size="small" fill="clear" (click)="inc(line)"><ion-icon name="add-outline" slot="icon-only"></ion-icon></ion-button>
                <ion-button size="small" fill="clear" color="danger" (click)="removeLine(line)"><ion-icon name="trash-outline" slot="icon-only"></ion-icon></ion-button>
              </div>
              <div class="line-sub">₱ {{ (line.item.price * line.qty) | number:'1.2-2' }}</div>
            </div>
            <div class="cart-total">
              <strong>Total</strong>
              <strong>₱ {{ cartTotal() | number:'1.2-2' }}</strong>
            </div>
            <ion-button expand="block" (click)="submitCart()" [disabled]="submitting()">
              <ion-spinner *ngIf="submitting()" name="dots" slot="start"></ion-spinner>
              {{ activeOrder() ? 'Add to order' : 'Place order' }}
            </ion-button>
          </div>
        </ion-footer>
      </ng-template>
    </ion-modal>

    <!-- Payment modal -->
    <ion-modal [isOpen]="payOpen()" (didDismiss)="payOpen.set(false)">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>Payment</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="payOpen.set(false)"><ion-icon name="close-outline" slot="icon-only"></ion-icon></ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <ng-container *ngIf="!receipt()">
            <h2 class="pay-total">₱ {{ activeOrder()?.total_amount | number:'1.2-2' }}</h2>
            <p class="pay-sub">Total due</p>

            <ion-item>
              <ion-label position="stacked">Cash received *</ion-label>
              <ion-input type="number" inputmode="decimal" [(ngModel)]="cashReceived"></ion-input>
            </ion-item>

            <div class="change-row" *ngIf="cashReceived != null">
              <span>Change</span>
              <span [class.neg]="changeAmount() < 0">₱ {{ changeAmount() | number:'1.2-2' }}</span>
            </div>

            <div class="quick">
              <ion-button fill="outline" size="small" (click)="setCash(activeOrder()?.total_amount || 0)">Exact</ion-button>
              <ion-button fill="outline" size="small" (click)="setCash(100)">100</ion-button>
              <ion-button fill="outline" size="small" (click)="setCash(200)">200</ion-button>
              <ion-button fill="outline" size="small" (click)="setCash(500)">500</ion-button>
              <ion-button fill="outline" size="small" (click)="setCash(1000)">1000</ion-button>
            </div>

            <ion-button expand="block" color="success" class="ion-margin-top"
                        (click)="confirmPay()" [disabled]="submitting() || changeAmount() < 0">
              <ion-spinner *ngIf="submitting()" name="dots" slot="start"></ion-spinner>
              <ion-icon *ngIf="!submitting()" name="checkmark-circle" slot="start"></ion-icon>
              Confirm payment
            </ion-button>
          </ng-container>

          <!-- Receipt -->
          <div class="receipt" *ngIf="receipt() as r">
            <pre>{{ receiptText(r) }}</pre>
            <ion-button expand="block" (click)="closeReceipt()">
              <ion-icon name="checkmark-circle" slot="start"></ion-icon>
              Done
            </ion-button>
          </div>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .spinner { display: flex; justify-content: center; padding: 60px; }

    .header-bar {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px; background: var(--ion-card-background, #fff); margin: 12px; border-radius: 12px;
    }
    .status { font-weight: 700; text-transform: uppercase; font-size: 14px; letter-spacing: 0.5px; }
    .status.available    { color: #2dd36f; }
    .status.not_yet_paid { color: #eb445a; }
    .total .label { font-size: 12px; color: var(--ion-color-medium); }
    .total .amount { font-size: 22px; font-weight: 800; color: #eb445a; }

    .active-order { background: var(--ion-card-background, #fff); margin: 12px; padding: 16px; border-radius: 12px; }
    .active-order h3 { margin: 0 0 12px; }
    .line { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed var(--ion-border-color); }
    .total-line { border-bottom: none; padding-top: 12px; font-size: 16px; }
    .actions { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }

    .cta { text-align: center; padding: 60px 24px; color: var(--ion-color-medium); }
    .cta ion-icon { font-size: 60px; margin-bottom: 12px; }
    .cta ion-button { margin-top: 16px; }

    .menu-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 10px; padding: 10px;
    }
    .menu-card {
      position: relative; overflow: hidden;
      background: var(--ion-card-background, #fff); border-radius: 10px; padding: 12px; text-align: center;
      cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .menu-card.unavail { opacity: 0.5; pointer-events: none; }
    .menu-card .name { font-weight: 700; }
    .menu-card .cat { font-size: 11px; color: var(--ion-color-medium); margin: 2px 0; }
    .menu-card .price { color: var(--tenant-primary, #3880ff); font-weight: 700; }
    .menu-card .unavail-tag {
      position: absolute; top: 6px; right: 6px; background: var(--ion-color-danger);
      color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px;
    }

    .cart {
      padding: 12px; background: var(--ion-card-background, #fff); border-top: 1px solid var(--ion-border-color);
    }
    .cart-line { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center; padding: 4px 0; }
    .line-name { font-weight: 600; }
    .line-controls { display: flex; align-items: center; gap: 4px; }
    .line-sub { font-weight: 700; min-width: 80px; text-align: right; }
    .cart-total { display: flex; justify-content: space-between; margin: 12px 0; font-size: 16px; }

    .pay-total { font-size: 36px; font-weight: 800; text-align: center; margin: 12px 0 0; color: #eb445a; }
    .pay-sub { text-align: center; color: var(--ion-color-medium); margin: 0 0 24px; }
    .change-row { display: flex; justify-content: space-between; padding: 12px; font-size: 18px; font-weight: 700; }
    .change-row .neg { color: var(--ion-color-danger); }
    .quick { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 8px; }

    .receipt pre {
      font-family: 'Courier New', monospace; background: #fffdf2; padding: 16px; border-radius: 8px;
      white-space: pre-wrap; word-wrap: break-word; font-size: 14px;
    }
  `],
})
export class EateryTableDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tablesApi = inject(RestaurantTableService);
  private readonly menuApi = inject(MenuItemService);
  private readonly ordersApi = inject(OrderService);
  private readonly paymentsApi = inject(EateryPaymentService);
  private readonly toast = inject(ToastController);

  readonly loading = signal(true);
  readonly table = signal<RestaurantTable | null>(null);
  readonly activeOrder = signal<Order | null>(null);
  readonly menu = signal<MenuItem[]>([]);

  readonly pickerOpen = signal(false);
  readonly payOpen = signal(false);
  readonly submitting = signal(false);
  readonly receipt = signal<Payment | null>(null);

  readonly cart = signal<CartLine[]>([]);
  searchTerm = '';
  cashReceived: number | null = null;

  readonly cartTotal = computed(() =>
    this.cart().reduce((s, l) => s + l.item.price * l.qty, 0),
  );

  readonly changeAmount = computed(() => {
    const due = this.activeOrder()?.total_amount ?? 0;
    return (this.cashReceived ?? 0) - due;
  });

  /**
   * Derive status from the active order rather than trusting `table.status` —
   * the column can drift out of sync, so the order's existence is the source
   * of truth: any unpaid active order ⇒ not_yet_paid; otherwise available.
   */
  readonly derivedStatus = computed<'available' | 'not_yet_paid'>(() =>
    this.activeOrder() ? 'not_yet_paid' : 'available',
  );

  readonly derivedStatusLabel = computed(() =>
    this.derivedStatus() === 'not_yet_paid' ? 'Not yet paid' : 'Available',
  );

  readonly filteredMenu = computed(() => {
    const q = this.searchTerm.trim().toLowerCase();
    const all = this.menu();
    if (!q) return all;
    return all.filter((m) =>
      m.name.toLowerCase().includes(q) ||
      (m.category || '').toLowerCase().includes(q),
    );
  });

  constructor() {
    addIcons({
      addOutline, removeOutline, cartOutline, cashOutline, closeOutline,
      checkmarkCircle, restaurantOutline, printOutline, trashOutline,
      arrowBack, banOutline,
    });
    this.load();
  }

  ionViewWillEnter(): void { this.load(); }

  load(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) return;
    this.loading.set(true);
    this.tablesApi.get(id).subscribe({
      next: (res) => {
        this.table.set(res.data || null);
        this.activeOrder.set(res.data?.active_order || null);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.flash('Could not load table', 'danger');
      },
    });
  }

  loadMenu(): void {
    if (this.menu().length > 0) return;
    this.menuApi.list({ availability: true }).subscribe({
      next: (res) => this.menu.set(res.data ?? []),
      error: () => this.flash('Could not load menu', 'danger'),
    });
  }

  openItemPicker(): void {
    this.cart.set([]);
    this.searchTerm = '';
    this.loadMenu();
    this.pickerOpen.set(true);
  }

  openPay(): void {
    this.cashReceived = this.activeOrder()?.total_amount ?? null;
    this.receipt.set(null);
    this.payOpen.set(true);
  }

  closeReceipt(): void {
    this.receipt.set(null);
    this.payOpen.set(false);
    this.load();
  }

  addToCart(m: MenuItem): void {
    if (!m.availability) return;
    this.cart.update((lines) => {
      const idx = lines.findIndex((l) => l.item.menu_item_id === m.menu_item_id);
      if (idx === -1) return [...lines, { item: m, qty: 1 }];
      const next = [...lines];
      next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
      return next;
    });
  }

  inc(line: CartLine): void { this.addToCart(line.item); }
  dec(line: CartLine): void {
    this.cart.update((lines) => {
      const idx = lines.findIndex((l) => l.item.menu_item_id === line.item.menu_item_id);
      if (idx === -1) return lines;
      const next = [...lines];
      next[idx] = { ...next[idx], qty: next[idx].qty - 1 };
      return next.filter((l) => l.qty > 0);
    });
  }
  removeLine(line: CartLine): void {
    this.cart.update((ls) => ls.filter((l) => l.item.menu_item_id !== line.item.menu_item_id));
  }

  submitCart(): void {
    if (this.cart().length === 0) return;
    const tableId = this.table()!.restaurant_table_id;
    const items = this.cart().map((l) => ({ menu_item_id: l.item.menu_item_id, quantity: l.qty }));
    this.submitting.set(true);

    const existing = this.activeOrder();
    // Offline-created orders have order_id === 0 — fall back to the local
    // uuid stashed by the repo so the offline service can resolve them.
    const ref = existing ? (existing.order_id || (existing as any)._local_uuid) : null;
    const obs = existing
      ? this.ordersApi.addItems(ref, { items })
      : this.ordersApi.create({ restaurant_table_id: tableId, items } satisfies CreateOrderDto);

    obs.subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.pickerOpen.set(false);
        this.cart.set([]);
        this.flash(existing ? 'Items added' : 'Order placed', 'success');
        this.activeOrder.set(res.data || null);
        this.load();
      },
      error: (err) => {
        this.submitting.set(false);
        this.flash(err?.error?.message || 'Could not save order', 'danger');
      },
    });
  }

  setCash(amount: number): void { this.cashReceived = amount; }

  confirmPay(): void {
    const order = this.activeOrder();
    if (!order) return;
    if (this.changeAmount() < 0) {
      this.flash('Insufficient cash', 'warning');
      return;
    }
    const dto: OfflineCreatePaymentDto = {
      order_id: order.order_id || undefined,
      order_local_uuid: (order as any)._local_uuid,
      cash_received: this.cashReceived ?? 0,
      payment_method: 'cash',
    };
    this.submitting.set(true);
    this.paymentsApi.pay(dto).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.receipt.set(res.data || null);
        this.flash('Payment received', 'success');
      },
      error: (err) => {
        this.submitting.set(false);
        this.flash(err?.error?.message || 'Payment failed', 'danger');
      },
    });
  }

  cancelOrder(): void {
    const o = this.activeOrder();
    if (!o) return;
    if (!confirm(`Cancel order ${o.order_number}?`)) return;
    const ref = o.order_id || (o as any)._local_uuid;
    this.ordersApi.cancel(ref).subscribe({
      next: () => {
        this.flash('Order cancelled', 'success');
        this.load();
      },
      error: (err) => this.flash(err?.error?.message || 'Could not cancel', 'danger'),
    });
  }

  receiptText(p: Payment): string {
    return (p.receipt?.print_lines ?? []).join('\n');
  }

  trackMenu = (_: number, m: MenuItem) => m.menu_item_id;

  private async flash(message: string, color: 'success' | 'danger' | 'warning') {
    const t = await this.toast.create({ message, duration: 1800, color, position: 'top' });
    t.present();
  }
}
