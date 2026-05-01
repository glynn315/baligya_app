import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  homeOutline, cartOutline, cubeOutline, receiptOutline, ellipsisHorizontalOutline,
} from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [CommonModule, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom" class="brand-tab-bar">
        <ion-tab-button tab="dashboard">
          <ion-icon name="home-outline"></ion-icon>
          <ion-label>Home</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="pos">
          <ion-icon name="cart-outline"></ion-icon>
          <ion-label>POS</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="products">
          <ion-icon name="cube-outline"></ion-icon>
          <ion-label>Products</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="sales">
          <ion-icon name="receipt-outline"></ion-icon>
          <ion-label>Sales</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="more">
          <ion-icon name="ellipsis-horizontal-outline"></ion-icon>
          <ion-label>More</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
  styles: [`
    .brand-tab-bar {
      --background: var(--ion-tab-bar-background);
      --color: var(--ion-color-medium);
      --color-selected: var(--tenant-primary);
      border-top: 1px solid var(--ion-border-color);
      padding-bottom: var(--safe-area-bottom);
      height: calc(56px + var(--safe-area-bottom));
    }
    ion-tab-button {
      --padding-top: 6px;
      --padding-bottom: 4px;
      ion-label { font-size: 11px; font-weight: 600; }
      ion-icon { font-size: 22px; }
    }
  `],
})
export class TabsPage {
  constructor() {
    addIcons({
      homeOutline, cartOutline, cubeOutline, receiptOutline,
      ellipsisHorizontalOutline,
    });
  }
}
