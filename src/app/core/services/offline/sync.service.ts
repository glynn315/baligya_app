import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  ApiResponse, MenuItem, Order, Payment, Product, RestaurantTable, Sale, Supplier,
} from '../../models/api.models';
import { EateryRepoService } from './eatery-repo.service';
import { NetworkService } from './network.service';
import { OutboxService, OutboxRow } from './outbox.service';
import { PosRepoService } from './pos-repo.service';
import { SqliteService } from './sqlite.service';

const MAX_ATTEMPTS = 5;

/**
 * Drains the offline outbox against the live API when the network is
 * up, and refreshes the cached menu/tables catalogs after a successful
 * drain so the next offline session has up-to-date reference data.
 *
 * The engine is idempotent — call `flush()` from anywhere, repeat
 * triggers while a flush is in-flight are short-circuited.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly http = inject(HttpClient);
  private readonly repo = inject(EateryRepoService);
  private readonly posRepo = inject(PosRepoService);
  private readonly outbox = inject(OutboxService);
  private readonly network = inject(NetworkService);
  private readonly db = inject(SqliteService);
  private readonly base = `${environment.apiBaseUrl}/eatery`;
  private readonly apiBase = environment.apiBaseUrl;

  readonly syncing = signal(false);
  readonly lastError = signal<string | null>(null);
  /**
   * Outbox rows that depend on an order which has no server id AND has
   * no pending/processing order-create row to ever give it one. These
   * are unrecoverable without manual intervention — the parent order
   * was either never enqueued or failed permanently before its
   * dependents were created. Surfaced as the "Discard N stuck" action.
   */
  readonly orphanedCount = signal(0);

  private flushing = false;

  /**
   * Manually drain the outbox. Triggered by the "Sync now" button in
   * the offline banner — there's no automatic flush on reconnect so
   * the cashier always controls when local writes hit MySQL.
   */
  async flush(): Promise<void> {
    if (this.flushing || !this.network.online()) return;
    this.flushing = true;
    this.syncing.set(true);
    this.lastError.set(null);

    try {
      // Drain in batches so a long backlog still surfaces progress.
      // Loop until either pending is empty or we hit an unrecoverable batch.
      while (this.network.online()) {
        const pending = await this.outbox.listPending(25);
        if (!pending.length) break;

        let progressed = false;
        for (const row of pending) {
          const ok = await this.processOne(row);
          if (ok) progressed = true;
          if (!this.network.online()) break;
        }
        if (!progressed) break; // avoid spinning if nothing succeeded
      }

      if (this.network.online()) {
        await this.pruneSyncedRecords();
      }
    } catch (e: any) {
      this.lastError.set(e?.message || 'Sync failed');
    } finally {
      this.flushing = false;
      this.syncing.set(false);
      await this.refreshOrphaned();
    }
  }

  /**
   * Count outbox rows that point at an order which (a) hasn't been
   * created server-side, and (b) has no pending order-create row that
   * could ever resolve it. These would otherwise loop forever in the
   * `if (!progressed) break` branch of flush().
   */
  async refreshOrphaned(): Promise<void> {
    const rows = await this.db.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM outbox
        WHERE status = 'pending' AND depends_on IS NOT NULL
          AND depends_on NOT IN (
            SELECT local_uuid FROM orders
             WHERE order_id IS NOT NULL AND order_id > 0
          )
          AND depends_on NOT IN (
            SELECT local_uuid FROM outbox
             WHERE entity = 'order' AND status IN ('pending', 'processing')
               AND local_uuid IS NOT NULL
          )`,
    );
    this.orphanedCount.set(Number(rows[0]?.n ?? 0));
  }

  /**
   * Drop every orphaned outbox row plus the local order/payment data
   * that was hanging off it. Returns how many orders' worth of clutter
   * got cleared. Run after the user explicitly confirms — this destroys
   * local data that never made it to MySQL and never will.
   */
  async discardOrphaned(): Promise<number> {
    const rows = await this.db.query<{ depends_on: string }>(
      `SELECT DISTINCT depends_on FROM outbox
        WHERE status = 'pending' AND depends_on IS NOT NULL
          AND depends_on NOT IN (
            SELECT local_uuid FROM orders
             WHERE order_id IS NOT NULL AND order_id > 0
          )
          AND depends_on NOT IN (
            SELECT local_uuid FROM outbox
             WHERE entity = 'order' AND status IN ('pending', 'processing')
               AND local_uuid IS NOT NULL
          )`,
    );
    const uuids = rows.map((r) => r.depends_on).filter(Boolean);
    if (!uuids.length) return 0;

    const placeholders = uuids.map(() => '?').join(',');
    await this.db.run(`DELETE FROM outbox      WHERE depends_on IN (${placeholders})`, uuids);
    await this.db.run(`DELETE FROM order_items WHERE order_local_uuid IN (${placeholders})`, uuids);
    await this.db.run(`DELETE FROM payments    WHERE order_local_uuid IN (${placeholders})`, uuids);
    await this.db.run(`DELETE FROM orders      WHERE local_uuid IN (${placeholders})`, uuids);

    await this.outbox.refreshPending();
    await this.refreshOrphaned();
    return uuids.length;
  }

  /** Returns true if the row was successfully drained (done or terminally failed). */
  private async processOne(row: OutboxRow): Promise<boolean> {
    // If this row depends on a parent that hasn't been created server-side
    // yet, skip — the parent will be processed later in the same flush.
    if (row.depends_on) {
      const parent = await this.repo.getOrderByLocalUuid(row.depends_on);
      if (!parent || !parent.order_id) {
        // Parent not yet known to server; try later (don't increment attempts).
        return false;
      }
      // Inject the resolved server id into the payload for entities that
      // reference an order id.
      if (row.entity === 'order_items' || row.entity === 'order_cancel' || row.entity === 'payment') {
        row.payload = { ...row.payload, _resolved_order_id: parent.order_id };
      }
    }

    try {
      await this.outbox.markProcessing(row.id);
      await this.dispatch(row);
      await this.outbox.markDone(row.id);
      return true;
    } catch (err: any) {
      const status = err?.status ?? 0;
      const permanent =
        // 4xx (except 401/408/429) are unlikely to recover by retrying.
        (status >= 400 && status < 500 && ![401, 408, 429].includes(status)) ||
        row.attempts + 1 >= MAX_ATTEMPTS;
      await this.outbox.markFailed(
        row.id, err?.error?.message || err?.message || `HTTP ${status}`,
        { permanent },
      );
      this.lastError.set(`Sync ${row.entity} failed: ${err?.error?.message || err?.message || status}`);
      // Network-style failures stop the flush so we don't churn the queue.
      if (status === 0) throw err;
      return permanent; // count it as drained when permanent
    }
  }

  private async dispatch(row: OutboxRow): Promise<void> {
    switch (row.entity) {
      case 'menu_item':        return this.dispatchMenuItem(row);
      case 'restaurant_table': return this.dispatchTable(row);
      case 'order':            return this.dispatchOrder(row);
      case 'order_items':      return this.dispatchOrderItems(row);
      case 'order_cancel':     return this.dispatchOrderCancel(row);
      case 'payment':          return this.dispatchPayment(row);
      // ─── Retail POS / Inventory (v2) ─────────────────────────
      case 'product':          return this.dispatchProduct(row);
      case 'supplier':         return this.dispatchSupplier(row);
      case 'sale_create':      return this.dispatchSaleCreate(row);
      case 'sale_commit':      return this.dispatchSaleCommit(row);
      case 'sale_refund':      return this.dispatchSaleRefund(row);
      case 'sale_void':        return this.dispatchSaleVoid(row);
      case 'inventory_adjust': return this.dispatchInventoryAdjust(row);
    }
  }

  // ─── Menu items ────────────────────────────────────────────────
  private async dispatchMenuItem(row: OutboxRow): Promise<void> {
    if (row.op === 'create') {
      const { _temp_id, ...body } = row.payload;
      const res = await firstValueFrom(
        this.http.post<ApiResponse<MenuItem>>(`${this.base}/menu`, body),
      );
      // Drop the optimistic temp row before inserting the real one — they
      // have different primary keys, so without this the list would dup.
      if (_temp_id) await this.repo.deleteMenuItem(_temp_id);
      if (res?.data) await this.repo.upsertMenuItem(res.data);
    } else if (row.op === 'update') {
      const { _id, ...body } = row.payload;
      const res = await firstValueFrom(
        this.http.put<ApiResponse<MenuItem>>(`${this.base}/menu/${_id}`, body),
      );
      if (res?.data) await this.repo.upsertMenuItem(res.data);
    } else if (row.op === 'delete') {
      const { _id } = row.payload;
      await firstValueFrom(this.http.delete<ApiResponse<null>>(`${this.base}/menu/${_id}`));
      await this.repo.deleteMenuItem(_id);
    }
  }

  // ─── Tables ────────────────────────────────────────────────────
  private async dispatchTable(row: OutboxRow): Promise<void> {
    if (row.op === 'create') {
      const { _temp_id, ...body } = row.payload;
      const res = await firstValueFrom(
        this.http.post<ApiResponse<RestaurantTable>>(`${this.base}/tables`, body),
      );
      if (_temp_id) await this.repo.deleteTable(_temp_id);
      if (res?.data) await this.repo.upsertTable(res.data);
    } else if (row.op === 'update') {
      const { _id, ...body } = row.payload;
      const res = await firstValueFrom(
        this.http.put<ApiResponse<RestaurantTable>>(`${this.base}/tables/${_id}`, body),
      );
      if (res?.data) await this.repo.upsertTable(res.data);
    } else if (row.op === 'delete') {
      const { _id } = row.payload;
      await firstValueFrom(this.http.delete<ApiResponse<null>>(`${this.base}/tables/${_id}`));
      await this.repo.deleteTable(_id);
    }
  }

  // ─── Orders ────────────────────────────────────────────────────
  private async dispatchOrder(row: OutboxRow): Promise<void> {
    if (row.op !== 'create' || !row.local_uuid) return;
    const res = await firstValueFrom(
      this.http.post<ApiResponse<Order>>(`${this.base}/orders`, row.payload),
    );
    if (res?.data) {
      // Reconcile the locally-created order with the server identity, then
      // point any dependent outbox rows at the new id.
      await this.repo.upsertOrder(res.data, { localUuid: row.local_uuid });
      await this.repo.setOrderServerId(row.local_uuid, res.data.order_id, res.data.order_number);
    }
  }

  private async dispatchOrderItems(row: OutboxRow): Promise<void> {
    const orderId = row.payload._resolved_order_id;
    if (!orderId) throw new Error('Order id not resolved for order_items');
    const body = { items: row.payload.items };
    const res = await firstValueFrom(
      this.http.post<ApiResponse<Order>>(`${this.base}/orders/${orderId}/items`, body),
    );
    if (res?.data && row.depends_on) {
      await this.repo.upsertOrder(res.data, { localUuid: row.depends_on });
    }
  }

  private async dispatchOrderCancel(row: OutboxRow): Promise<void> {
    const orderId = row.payload._resolved_order_id;
    if (!orderId) throw new Error('Order id not resolved for order_cancel');
    await firstValueFrom(
      this.http.post<ApiResponse<Order>>(`${this.base}/orders/${orderId}/cancel`, {}),
    );
  }

  // ─── Payments ──────────────────────────────────────────────────
  private async dispatchPayment(row: OutboxRow): Promise<void> {
    const body = { ...row.payload };
    if (body._resolved_order_id) {
      body.order_id = body._resolved_order_id;
      delete body._resolved_order_id;
    }
    const localUuid = row.local_uuid;
    const res = await firstValueFrom(
      this.http.post<ApiResponse<Payment>>(`${this.base}/payments`, body),
    );
    if (res?.data) {
      if (localUuid) await this.repo.setPaymentServerId(localUuid, res.data.payment_id);
      if (res.data.order_id) {
        const existing = await this.repo.getOrderByServerId(res.data.order_id);
        if (existing) await this.repo.markOrderPaid((existing as any)._local_uuid);
      }
    }
  }

  // ─── Retail POS / Inventory (v2) ───────────────────────────────
  private async dispatchProduct(row: OutboxRow): Promise<void> {
    if (row.op === 'create') {
      const { _temp_id, ...body } = row.payload;
      const res = await firstValueFrom(
        this.http.post<ApiResponse<Product>>(`${this.apiBase}/products`, body),
      );
      if (_temp_id) await this.posRepo.deleteProduct(_temp_id);
      if (res?.data) await this.posRepo.upsertProduct(res.data);
    } else if (row.op === 'update') {
      const { _id, ...body } = row.payload;
      const res = await firstValueFrom(
        this.http.put<ApiResponse<Product>>(`${this.apiBase}/products/${_id}`, body),
      );
      if (res?.data) await this.posRepo.upsertProduct(res.data);
    } else if (row.op === 'delete') {
      const { _id } = row.payload;
      await firstValueFrom(this.http.delete<ApiResponse<null>>(`${this.apiBase}/products/${_id}`));
      await this.posRepo.deleteProduct(_id);
    }
  }

  private async dispatchSupplier(row: OutboxRow): Promise<void> {
    if (row.op === 'create') {
      const { _temp_id, ...body } = row.payload;
      const res = await firstValueFrom(
        this.http.post<ApiResponse<Supplier>>(`${this.apiBase}/suppliers`, body),
      );
      if (res?.data) await this.posRepo.cacheSuppliers([res.data]);
    } else if (row.op === 'update') {
      const { _id, ...body } = row.payload;
      const res = await firstValueFrom(
        this.http.put<ApiResponse<Supplier>>(`${this.apiBase}/suppliers/${_id}`, body),
      );
      if (res?.data) await this.posRepo.cacheSuppliers([res.data]);
    } else if (row.op === 'delete') {
      const { _id } = row.payload;
      await firstValueFrom(this.http.delete<ApiResponse<null>>(`${this.apiBase}/suppliers/${_id}`));
    }
  }

  private async dispatchSaleCreate(row: OutboxRow): Promise<void> {
    const { _local_uuid, ...body } = row.payload;
    await firstValueFrom(
      this.http.post<ApiResponse<Sale>>(`${this.apiBase}/sales`, body),
    );
    if (_local_uuid) await this.posRepo.deleteSaleDraft(_local_uuid);
  }

  private async dispatchSaleCommit(row: OutboxRow): Promise<void> {
    const { _id, ...body } = row.payload;
    await firstValueFrom(
      this.http.post<ApiResponse<Sale>>(`${this.apiBase}/sales/${_id}/commit`, body),
    );
  }

  private async dispatchSaleRefund(row: OutboxRow): Promise<void> {
    const { _id, ...body } = row.payload;
    await firstValueFrom(
      this.http.post<ApiResponse<any>>(`${this.apiBase}/sales/${_id}/refund`, body),
    );
  }

  private async dispatchSaleVoid(row: OutboxRow): Promise<void> {
    const { _id, ...body } = row.payload;
    await firstValueFrom(
      this.http.post<ApiResponse<Sale>>(`${this.apiBase}/sales/${_id}/void`, body),
    );
  }

  private async dispatchInventoryAdjust(row: OutboxRow): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<ApiResponse<Product>>(`${this.apiBase}/inventory/adjust`, row.payload),
    );
    if (res?.data) await this.posRepo.upsertProduct(res.data);
  }

  // ─── Prune ─────────────────────────────────────────────────────
  /**
   * Removes local copies of mutations that have been accepted by MySQL.
   *
   * Kept after sync: cached menu items + restaurant tables (so the next
   *   offline session has reference data to read).
   * Deleted after sync: order/order_item/payment rows that now have a
   *   server id, and outbox rows in 'done' status. An order is only
   *   pruned once nothing in the outbox still references its local_uuid
   *   — guards against deleting a parent while a child row is mid-retry.
   */
  private async pruneSyncedRecords(): Promise<void> {
    // Payments are leaf nodes — safe to drop as soon as the server has them.
    await this.db.run(
      `DELETE FROM payments WHERE payment_id IS NOT NULL AND payment_id > 0`,
    );

    const orphanedOrders = await this.db.query<{ local_uuid: string }>(
      `SELECT local_uuid FROM orders
        WHERE order_id IS NOT NULL AND order_id > 0
          AND local_uuid NOT IN (
            SELECT depends_on FROM outbox
             WHERE depends_on IS NOT NULL AND status IN ('pending', 'processing')
          )`,
    );
    for (const row of orphanedOrders) {
      await this.db.run('DELETE FROM order_items WHERE order_local_uuid = ?', [row.local_uuid]);
      await this.db.run('DELETE FROM orders WHERE local_uuid = ?', [row.local_uuid]);
    }

    // Tidy up successfully-drained outbox rows.
    await this.db.run(`DELETE FROM outbox WHERE status = 'done'`);
    await this.outbox.refreshPending();
  }
}
