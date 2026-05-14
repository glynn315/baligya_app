import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

import { BarcodeScanResult } from '../models/api.models';

const SUPPORTED_FORMATS = ['QR_CODE', 'EAN_13', 'EAN_8', 'CODE_128', 'CODE_39', 'UPC_A', 'UPC_E'];

/**
 * Thin wrapper around @capacitor-mlkit/barcode-scanning. Supports both:
 *
 *   - `scanOnce()` — opens the system scanner UI and returns one
 *     barcode. Used when there's an existing form context.
 *
 *   - `startContinuousScan()` — runs the live camera preview behind a
 *     transparent WebView and emits every detected barcode through a
 *     callback (like a mall POS scanner). Use the returned `stop()`
 *     function to clean up.
 *
 * On web (or if the plugin isn't installed) all methods reject so call
 * sites can fall back to manual entry.
 */
@Injectable({ providedIn: 'root' })
export class BarcodeScannerService {
  /** Active stop() handle for the in-progress continuous scan, if any. */
  private activeStop: (() => Promise<void>) | null = null;

  get isNative(): boolean {
    return Capacitor.getPlatform() !== 'web';
  }

  async isSupported(): Promise<boolean> {
    if (!this.isNative) return false;
    try {
      const mod: any = await import('@capacitor-mlkit/barcode-scanning');
      const res = await mod.BarcodeScanner.isSupported();
      return !!res?.supported;
    } catch {
      return false;
    }
  }

  async ensurePermission(): Promise<boolean> {
    if (!this.isNative) return false;
    try {
      const mod: any = await import('@capacitor-mlkit/barcode-scanning');
      const status = await mod.BarcodeScanner.checkPermissions();
      if (status?.camera === 'granted') return true;
      const req = await mod.BarcodeScanner.requestPermissions();
      return req?.camera === 'granted';
    } catch {
      return false;
    }
  }

  /**
   * One-shot scan using the plugin's bundled scanner Activity. Returns
   * the first decoded barcode, or `null` if user cancels.
   */
  async scanOnce(): Promise<BarcodeScanResult | null> {
    if (!this.isNative) throw new Error('Scanner only available on native device');
    const ok = await this.ensurePermission();
    if (!ok) throw new Error('Camera permission denied');

    const mod: any = await import('@capacitor-mlkit/barcode-scanning');
    const formats = this.resolveFormats(mod);

    const { barcodes } = await mod.BarcodeScanner.scan({ formats });
    if (!barcodes?.length) return null;
    return this.toResult(barcodes[0]);
  }

  /**
   * Live camera preview + continuous decode. The page that calls this
   * MUST also toggle `body.barcode-scanning-active` (handled by the
   * scanner modal) — that's what makes the WebView background
   * transparent so the camera feed shows through.
   *
   * Returns a `stop()` function the caller must invoke when done.
   */
  async startContinuousScan(onBarcode: (r: BarcodeScanResult) => void): Promise<() => Promise<void>> {
    if (!this.isNative) throw new Error('Scanner only available on native device');
    const ok = await this.ensurePermission();
    if (!ok) throw new Error('Camera permission denied');

    // If a prior scan wasn't cleaned up, do it now to avoid double-start.
    if (this.activeStop) {
      try { await this.activeStop(); } catch { /* ignore */ }
      this.activeStop = null;
    }

    const mod: any = await import('@capacitor-mlkit/barcode-scanning');
    const formats = this.resolveFormats(mod);

    // Make the WebView container transparent so the native camera shows.
    document.body.classList.add('barcode-scanning-active');

    const listener = await mod.BarcodeScanner.addListener('barcodeScanned', (event: any) => {
      const b = event?.barcode;
      if (b?.rawValue) onBarcode(this.toResult(b));
    });

    await mod.BarcodeScanner.startScan({ formats });

    const stop = async (): Promise<void> => {
      try { await listener.remove(); } catch { /* ignore */ }
      try { await mod.BarcodeScanner.stopScan(); } catch { /* ignore */ }
      document.body.classList.remove('barcode-scanning-active');
      this.activeStop = null;
    };
    this.activeStop = stop;
    return stop;
  }

  /** Force-stop any in-flight continuous scan (used on app pause / hard nav). */
  async stopAll(): Promise<void> {
    if (this.activeStop) {
      try { await this.activeStop(); } catch { /* ignore */ }
      this.activeStop = null;
    }
  }

  /** Toggle the device torch while a continuous scan is active. */
  async toggleTorch(): Promise<boolean | null> {
    if (!this.isNative) return null;
    try {
      const mod: any = await import('@capacitor-mlkit/barcode-scanning');
      const supported = await mod.BarcodeScanner.isTorchAvailable?.();
      if (!supported?.available) return null;
      const cur = await mod.BarcodeScanner.isTorchEnabled?.();
      if (cur?.enabled) {
        await mod.BarcodeScanner.disableTorch();
        return false;
      }
      await mod.BarcodeScanner.enableTorch();
      return true;
    } catch {
      return null;
    }
  }

  // ─── Internals ──────────────────────────────────────────────────
  private resolveFormats(mod: any): any[] {
    return SUPPORTED_FORMATS
      .map((f) => mod.BarcodeFormat?.[this.toEnumKey(f)])
      .filter(Boolean);
  }

  private toResult(b: any): BarcodeScanResult {
    return {
      rawValue: String(b.rawValue ?? b.displayValue ?? ''),
      format: String(b.format ?? 'UNKNOWN'),
    };
  }

  // MLKit uses PascalCase enum keys (QrCode, Ean13, ...). Map our screaming-snake constants.
  private toEnumKey(format: string): string {
    return format
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }
}
