import { Component, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonRefresher, IonRefresherContent,
  IonIcon, IonSkeletonText, IonButtons, IonBackButton,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  swapHorizontalOutline, arrowDownOutline, arrowUpOutline, timeOutline,
} from 'ionicons/icons';

import { InventoryService } from '../../core/services/expense.service';
import { InventoryLog } from '../../core/models/api.models';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    CommonModule, DatePipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonRefresher, IonRefresherContent,
    IonIcon, IonSkeletonText, IonButtons, IonBackButton,
  ],
  templateUrl: './inventory.page.html',
  styleUrls: ['./inventory.page.scss'],
})
export class InventoryPage {
  private readonly inventory = inject(InventoryService);

  readonly loading = signal(true);
  readonly logs = signal<InventoryLog[]>([]);

  constructor() {
    addIcons({ swapHorizontalOutline, arrowDownOutline, arrowUpOutline, timeOutline });
    this.load();
  }

  ionViewWillEnter(): void { this.load(); }

  load(event?: Event): void {
    this.loading.set(true);
    this.inventory.logs({ per_page: 50 }).subscribe({
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
}
