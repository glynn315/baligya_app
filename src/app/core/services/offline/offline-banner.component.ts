import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, IonSpinner, ToastController, AlertController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cloudOfflineOutline, cloudUploadOutline, syncOutline,
  checkmarkCircleOutline, trashOutline, alertCircleOutline,
} from 'ionicons/icons';

import { NetworkService } from './network.service';
import { OutboxService } from './outbox.service';
import { SyncService } from './sync.service';

/**
 * Floating status pill cluster. Possible states (each row is one pill):
 *   - offline           → red "Offline"
 *   - online + syncable → blue "Sync N" button → triggers flush
 *   - online + stuck    → amber "Discard N stuck" button → asks confirm,
 *                          then drops orphaned outbox rows whose parent
 *                          order will never sync
 *
 * Multiple states can show at once (e.g. some rows are syncable, others
 * are stuck), in which case both pills appear stacked.
 */
@Component({
  selector: 'app-offline-banner',
  standalone: true,
  imports: [CommonModule, IonIcon, IonSpinner],
  template: `
    <div class="stack">
      <div class="banner offline" *ngIf="!network.online()">
        <ion-icon name="cloud-offline-outline"></ion-icon>
        <span>Offline</span>
      </div>

      <button
        type="button"
        class="banner sync"
        *ngIf="network.online() && syncablePending() > 0"
        [disabled]="sync.syncing()"
        (click)="onSync()">
        <ion-spinner *ngIf="sync.syncing()" name="dots"></ion-spinner>
        <ion-icon *ngIf="!sync.syncing()" name="cloud-upload-outline"></ion-icon>
        <span *ngIf="!sync.syncing()">Sync {{ syncablePending() }}</span>
        <span *ngIf="sync.syncing()">Syncing…</span>
      </button>

      <button
        type="button"
        class="banner stuck"
        *ngIf="sync.orphanedCount() > 0"
        (click)="onDiscard()">
        <ion-icon name="alert-circle-outline"></ion-icon>
        <span>Discard {{ sync.orphanedCount() }} stuck</span>
      </button>
    </div>
  `,
  styles: [`
    .stack {
      position: fixed; top: env(safe-area-inset-top, 8px); left: 50%;
      transform: translateX(-50%); z-index: 9999;
      display: flex; flex-direction: column; gap: 6px; align-items: center;
    }
    .banner {
      color: white;
      padding: 6px 14px; border-radius: 999px;
      font-size: 12px; font-weight: 600;
      display: flex; align-items: center; gap: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      border: none; cursor: pointer; font-family: inherit;
    }
    .banner.offline { background: #eb445a; cursor: default; }
    .banner.sync    { background: #3880ff; }
    .banner.stuck   { background: #ff9900; }
    .banner.sync[disabled] { opacity: 0.7; cursor: progress; }
    ion-icon { font-size: 14px; }
    ion-spinner { width: 14px; height: 14px; }
  `],
})
export class OfflineBannerComponent {
  readonly network = inject(NetworkService);
  readonly outbox = inject(OutboxService);
  readonly sync = inject(SyncService);
  private readonly toast = inject(ToastController);
  private readonly alert = inject(AlertController);

  /**
   * pendingCount includes the orphaned ones (they still have
   * status='pending'), so subtract them to know how many would actually
   * make progress on a flush.
   */
  readonly syncablePending = computed(() =>
    Math.max(0, this.outbox.pendingCount() - this.sync.orphanedCount()),
  );

  constructor() {
    addIcons({
      cloudOfflineOutline, cloudUploadOutline, syncOutline,
      checkmarkCircleOutline, trashOutline, alertCircleOutline,
    });
  }

  async onSync(): Promise<void> {
    const before = this.outbox.pendingCount();
    await this.sync.flush();
    const remaining = this.outbox.pendingCount();
    const synced = Math.max(0, before - remaining);

    const err = this.sync.lastError();
    const t = await this.toast.create({
      message: err
        ? `Sync error: ${err}`
        : `Synced ${synced} change${synced === 1 ? '' : 's'} to MySQL`,
      duration: 2200,
      color: err ? 'danger' : 'success',
      position: 'top',
    });
    t.present();
  }

  async onDiscard(): Promise<void> {
    const n = this.sync.orphanedCount();
    const a = await this.alert.create({
      header: 'Discard stuck items?',
      message:
        `${n} queued change${n === 1 ? '' : 's'} can't sync because the ` +
        `parent order was never created on the server. Discarding will ` +
        `delete them from this device permanently. They will NOT appear in MySQL.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Discard',
          role: 'destructive',
          handler: async () => {
            const cleared = await this.sync.discardOrphaned();
            const t = await this.toast.create({
              message: `Discarded ${cleared} stuck order group${cleared === 1 ? '' : 's'}`,
              duration: 2000,
              color: 'warning',
              position: 'top',
            });
            t.present();
          },
        },
      ],
    });
    a.present();
  }
}
