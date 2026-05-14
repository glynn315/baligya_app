import { Component, inject, Input, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonIcon, IonInput, IonButton, IonNote, ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  closeOutline, scanOutline, qrCodeOutline, flashlightOutline,
  keypadOutline, checkmarkCircleOutline,
} from 'ionicons/icons';

import { BarcodeScannerService } from '../../core/services/barcode-scanner.service';
import { BarcodeScanResult } from '../../core/models/api.models';

/**
 * Live-camera barcode scanner modal.
 *
 * Single-shot mode (default): first detected barcode auto-dismisses
 * the modal with the result. Used by Products / Inventory pages.
 *
 * Continuous mode (`continuous=true` + `onScan` callback): the modal
 * stays open and fires `onScan` for every detected barcode — same UX
 * as a mall POS gun scanner. Used by the POS cart flow so a cashier
 * can rip through a stack of items without re-opening the modal.
 *
 * In both modes the live camera preview sits behind a transparent
 * WebView (see `body.barcode-scanning-active` rules in global.scss),
 * and a viewfinder + sweeping scan line overlay is drawn on top.
 * Manual text entry is always available as a fallback.
 */
@Component({
  selector: 'app-barcode-scan-modal',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    IonIcon, IonInput, IonButton, IonNote,
  ],
  template: `
    <!-- Manual-entry fallback panel (shown when camera is unavailable
         OR user explicitly switches to manual). Sits on a normal opaque
         background, NOT over the camera. -->
    <div *ngIf="!live()" class="manual-panel ion-padding">
      <div class="manual-header">
        <h2>Scan barcode</h2>
        <button type="button" class="icon-btn" (click)="cancel()" aria-label="Close">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>

      <div class="hero">
        <ion-icon name="qr-code-outline"></ion-icon>
        <p>Camera scanner is not available on this device.</p>
        <small>Enter the code manually below.</small>
      </div>

      <ion-button
        *ngIf="canUseCamera()"
        expand="block"
        fill="outline"
        (click)="startLive()"
      >
        <ion-icon slot="start" name="scan-outline"></ion-icon>
        Use camera scanner
      </ion-button>

      <form [formGroup]="form" (ngSubmit)="submitManual()" class="manual">
        <ion-input
          label="Barcode / SKU"
          labelPlacement="stacked"
          formControlName="value"
          placeholder="e.g., 4901234567894"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
        ></ion-input>
        <ion-button expand="block" type="submit" class="brand-btn" [disabled]="form.invalid">
          Use code
        </ion-button>
      </form>

      <ion-button *ngIf="allowSkip" expand="block" fill="clear" color="medium" (click)="skip()">
        Skip — continue without barcode
      </ion-button>

      <ion-note *ngIf="error()" color="danger" style="display:block; text-align:center; margin-top:6px;">
        {{ error() }}
      </ion-note>
    </div>

    <!-- Live camera scanner overlay. The body class makes everything
         behind transparent; this fixed-position layer paints the chrome. -->
    <div *ngIf="live()" class="scanner-overlay" role="dialog" aria-label="Barcode scanner">
      <div class="scanner-toolbar-top">
        <button class="scanner-iconbtn" (click)="cancel()" aria-label="Close">
          <ion-icon name="close-outline"></ion-icon>
        </button>
        <p style="margin:0; font-weight:600; flex:1; text-align:center;">
          {{ continuous ? 'Continuous scan' : 'Aim at barcode' }}
        </p>
        <button class="scanner-iconbtn" (click)="toggleTorch()" aria-label="Toggle flashlight">
          <ion-icon name="flashlight-outline"></ion-icon>
        </button>
      </div>

      <div class="scanner-viewfinder">
        <span class="corner bl"></span>
        <span class="corner br"></span>
        <div class="scanner-line"></div>
      </div>

      <div class="scanner-toolbar-bottom">
        <p class="scanner-status">
          QR · EAN-13 · CODE-128 · UPC<br />
          Auto-detect — no need to tap.
        </p>
        <p *ngIf="lastScan()" class="scanner-recent">
          <ion-icon name="checkmark-circle-outline"></ion-icon>
          {{ lastScanMessage() }}
        </p>
        <ion-button expand="block" fill="outline" color="light" (click)="switchToManual()">
          <ion-icon slot="start" name="keypad-outline"></ion-icon>
          Enter manually
        </ion-button>
        <ion-button *ngIf="continuous" expand="block" class="brand-btn" (click)="done()">
          Done
        </ion-button>
        <ion-button *ngIf="allowSkip && !continuous" expand="block" fill="clear" color="light" (click)="skip()">
          Skip — continue without barcode
        </ion-button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; background: transparent; }
    .manual-panel { background: var(--ion-background-color, #fff); height: 100%; display: flex; flex-direction: column; gap: 12px; }
    .manual-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 6px; border-bottom: 1px solid var(--ion-border-color); h2 { margin: 0; font-size: 18px; font-weight: 700; } .icon-btn { width: 36px; height: 36px; border: 0; border-radius: 50%; background: var(--ion-color-light); display: inline-flex; align-items: center; justify-content: center; ion-icon { font-size: 20px; } } }
    .hero {
      text-align: center; padding: 24px 16px;
      background: var(--ion-card-background, #fff);
      border: 1px solid var(--ion-border-color, #e5e7eb); border-radius: 16px;
      ion-icon { font-size: 56px; color: var(--baligya-700, #2563eb); }
      p { margin: 8px 0 4px; font-weight: 600; }
      small { color: var(--ion-color-medium); }
    }
    .manual { display: flex; flex-direction: column; gap: 10px; }
    .brand-btn { --background: var(--tenant-primary); --color: #fff; }
  `],
})
export class BarcodeScanModalComponent implements OnDestroy {
  private readonly modal = inject(ModalController);
  private readonly scanner = inject(BarcodeScannerService);
  private readonly fb = inject(FormBuilder);

  /** When true, shows a "Skip — continue without barcode" action. */
  @Input() allowSkip = false;

  /** Continuous (POS-style) mode: don't dismiss on each scan. */
  @Input() continuous = false;

  /**
   * Called for every successful scan. In continuous mode this is the
   * primary output; in single-shot mode the modal also dismisses with
   * the same result via `onDidDismiss`.
   */
  @Input() onScan?: (r: BarcodeScanResult) => void;

  readonly live = signal(false);
  readonly canUseCamera = signal(false);
  readonly error = signal<string | null>(null);
  readonly lastScan = signal<BarcodeScanResult | null>(null);
  readonly lastScanMessage = signal<string>('');

  readonly form = this.fb.nonNullable.group({
    value: ['', [Validators.required, Validators.minLength(2)]],
  });

  // Plugin's "barcodeScanned" can fire the same code multiple times
  // in rapid succession while the user is still aiming. Throttle to
  // one identical code per 1.2 seconds. Different codes pass through.
  private lastRaw: string | null = null;
  private lastAt = 0;

  private stop: (() => Promise<void>) | null = null;

  constructor() {
    addIcons({
      closeOutline, scanOutline, qrCodeOutline, flashlightOutline,
      keypadOutline, checkmarkCircleOutline,
    });
    void this.scanner.isSupported().then((v) => {
      this.canUseCamera.set(v);
      // Auto-start live preview when supported — that's what the user
      // wants ("don't tap to scan, just show the camera").
      if (v) void this.startLive();
    });
  }

  async startLive(): Promise<void> {
    this.error.set(null);
    try {
      this.stop = await this.scanner.startContinuousScan((r) => this.handleScan(r));
      this.live.set(true);
    } catch (e: any) {
      this.error.set(e?.message || 'Scanner failed to start');
      this.live.set(false);
    }
  }

  private handleScan(r: BarcodeScanResult): void {
    const now = Date.now();
    if (r.rawValue === this.lastRaw && now - this.lastAt < 1200) return;
    this.lastRaw = r.rawValue;
    this.lastAt = now;
    this.lastScan.set(r);
    this.lastScanMessage.set(`Scanned: ${r.rawValue}`);

    if (this.continuous) {
      // Stay open; let the page do its own work (add-to-cart, etc.)
      this.onScan?.(r);
    } else {
      this.onScan?.(r);
      void this.dismissWith(r, 'scanned');
    }
  }

  switchToManual(): void {
    void this.stopLive().then(() => this.live.set(false));
  }

  async toggleTorch(): Promise<void> {
    await this.scanner.toggleTorch();
  }

  submitManual(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue().value.trim();
    if (!value) return;
    const result: BarcodeScanResult = { rawValue: value, format: 'MANUAL' };
    this.onScan?.(result);
    void this.dismissWith(result, 'manual');
  }

  done(): void { void this.dismissWith(null, 'done'); }
  cancel(): void { void this.dismissWith(null, 'cancel'); }
  skip(): void { void this.dismissWith(null, 'skip'); }

  ngOnDestroy(): void { void this.stopLive(); }

  private async stopLive(): Promise<void> {
    if (this.stop) { try { await this.stop(); } catch { /* ignore */ } this.stop = null; }
  }

  private async dismissWith(data: BarcodeScanResult | null, role: string): Promise<void> {
    await this.stopLive();
    await this.modal.dismiss(data, role);
  }
}
