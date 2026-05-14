import { Component, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonRefresher, IonRefresherContent,
  IonIcon, IonSkeletonText, IonButtons, IonBackButton, IonFab, IonFabButton,
  IonModal, IonInput, IonSelect, IonSelectOption, IonTextarea, IonButton, IonSpinner,
  IonCheckbox, ModalController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  swapHorizontalOutline, arrowDownOutline, arrowUpOutline, timeOutline,
  addOutline, closeOutline, scanOutline, filterOutline,
} from 'ionicons/icons';

import { InventoryService } from '../../core/services/expense.service';
import { ProductService } from '../../core/services/product.service';
import { AuthService } from '../../core/services/auth.service';
import { InventoryLog, Product } from '../../core/models/api.models';
import { BarcodeScanModalComponent } from '../../shared/components/barcode-scan-modal.component';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DatePipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonRefresher, IonRefresherContent,
    IonIcon, IonSkeletonText, IonButtons, IonBackButton, IonFab, IonFabButton,
    IonModal, IonInput, IonSelect, IonSelectOption, IonTextarea, IonButton, IonSpinner,
    IonCheckbox,
  ],
  templateUrl: './inventory.page.html',
  styleUrls: ['./inventory.page.scss'],
})
export class InventoryPage {
  private readonly inventory = inject(InventoryService);
  private readonly products = inject(ProductService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);
  readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly logs = signal<InventoryLog[]>([]);

  // Filters
  readonly typeFilter = signal<string>('');
  readonly dateFrom = signal<string>('');
  readonly dateTo = signal<string>('');

  // Add Stock modal
  readonly addOpen = signal(false);
  readonly target = signal<Product | null>(null);
  readonly qty = signal<number>(0);
  readonly type = signal<'purchase' | 'adjustment' | 'return'>('purchase');
  readonly notes = signal<string>('');
  readonly allowNegative = signal<boolean>(false);
  readonly submitting = signal(false);

  constructor() {
    addIcons({
      swapHorizontalOutline, arrowDownOutline, arrowUpOutline, timeOutline,
      addOutline, closeOutline, scanOutline, filterOutline,
    });
    this.load();
  }

  ionViewWillEnter(): void { this.load(); }

  load(event?: Event): void {
    this.loading.set(true);
    this.inventory.logs({
      per_page: 50,
      type: this.typeFilter() || undefined,
      date_from: this.dateFrom() || undefined,
      date_to: this.dateTo() || undefined,
    }).subscribe({
      next: (res: any) => {
        const data = res?.data?.data ?? res?.data ?? [];
        this.logs.set(Array.isArray(data) ? data : []);
        this.loading.set(false);
        (event as any)?.target?.complete?.();
      },
      error: () => {
        this.loading.set(false);
        (event as any)?.target?.complete?.();
      },
    });
  }

  applyFilter(): void { this.load(); }

  /**
   * Tap "+" → open the scanner first. Only after a product is resolved
   * (existing in catalog) does the qty / type / notes form appear.
   * If the barcode is unknown, warn the user to create the product first
   * in Products → that page handles new-product creation.
   */
  async openAddStock(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: BarcodeScanModalComponent,
      cssClass: 'scanner-fullscreen-modal',
    });
    await modal.present();
    const { data, role } = await modal.onDidDismiss();
    if (role === 'cancel' || !data?.rawValue) return;

    const code = String(data.rawValue);
    this.products.findByBarcode(code).subscribe({
      next: (res) => {
        if (res?.data) {
          this.target.set(res.data as Product);
          this.qty.set(0);
          this.type.set('purchase');
          this.notes.set('');
          this.allowNegative.set(false);
          this.addOpen.set(true);
        } else {
          this.flash(`No product for "${code}". Create it in Products first.`, 'warning');
        }
      },
      error: () => this.flash('Lookup failed', 'danger'),
    });
  }

  /** Re-scan from inside the open form to pick a different product. */
  async scanProduct(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: BarcodeScanModalComponent,
      cssClass: 'scanner-fullscreen-modal',
    });
    await modal.present();
    const { data, role } = await modal.onDidDismiss();
    if (role === 'cancel' || !data?.rawValue) return;
    this.products.findByBarcode(String(data.rawValue)).subscribe({
      next: (res) => {
        if (res?.data) {
          this.target.set(res.data as Product);
        } else {
          this.flash(`No product for "${data.rawValue}"`, 'warning');
        }
      },
      error: () => this.flash('Lookup failed', 'danger'),
    });
  }

  save(): void {
    const t = this.target();
    const q = Number(this.qty());
    if (!t || !q) { this.flash('Pick a product and enter a quantity', 'danger'); return; }
    this.submitting.set(true);
    this.inventory.adjust({
      product_id: t.id,
      quantity: q,
      type: this.type(),
      notes: this.notes() || undefined,
      allow_negative: (this.allowNegative() && this.auth.isManagerOrAbove()) || undefined,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.flash(`Stock adjusted by ${q > 0 ? '+' : ''}${q}`, 'success');
        this.addOpen.set(false);
        this.load();
      },
      error: (err) => {
        this.submitting.set(false);
        this.flash(err?.error?.message || 'Could not adjust stock', 'danger');
      },
    });
  }

  private async flash(message: string, color: 'success' | 'danger' | 'warning') {
    const t = await this.toast.create({ message, duration: 1800, color, position: 'top' });
    t.present();
  }
}
