import { inject, Injectable } from '@angular/core';

import {
  MenuItem, Order, OrderItem, Payment, RestaurantTable,
} from '../../models/api.models';
import { SqliteService } from './sqlite.service';

/**
 * SQLite-backed repository for the eatery domain. Reads return shapes
 * compatible with the API models so call sites don't have to branch on
 * online/offline.
 *
 * Identity convention:
 *   - Server-issued entities have their original numeric id (menu_item_id,
 *     order_id, …) AND a row in SQLite.
 *   - Locally-created entities (offline writes) have a `local_uuid` and
 *     either a negative placeholder id or null for the server id, until
 *     the sync engine reconciles them.
 */
@Injectable({ providedIn: 'root' })
export class EateryRepoService {
  private readonly db = inject(SqliteService);

  // ─── Menu items ────────────────────────────────────────────────
  async cacheMenuItems(items: MenuItem[]): Promise<void> {
    if (!items?.length) return;
    const set = items.map((m) => ({
      statement: `INSERT OR REPLACE INTO menu_items
        (menu_item_id, name, price, category, category_id, description, image_url, availability, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?)`,
      values: [
        m.menu_item_id, m.name, m.price, m.category ?? null, m.category_id ?? null,
        m.description ?? null, m.image_url ?? null, m.availability ? 1 : 0,
        m.updated_at ?? new Date().toISOString(),
      ],
    }));
    await this.db.exec(set);
  }

  async upsertMenuItem(m: MenuItem): Promise<void> {
    await this.cacheMenuItems([m]);
  }

  async listMenuItems(): Promise<MenuItem[]> {
    const rows = await this.db.query<any>('SELECT * FROM menu_items ORDER BY name');
    return rows.map(this.toMenuItem);
  }

  async getMenuItem(id: number): Promise<MenuItem | null> {
    const rows = await this.db.query<any>(
      'SELECT * FROM menu_items WHERE menu_item_id = ? LIMIT 1', [id],
    );
    return rows[0] ? this.toMenuItem(rows[0]) : null;
  }

  async deleteMenuItem(id: number): Promise<void> {
    await this.db.run('DELETE FROM menu_items WHERE menu_item_id = ?', [id]);
  }

  private toMenuItem = (r: any): MenuItem => ({
    menu_item_id: r.menu_item_id,
    name: r.name,
    price: Number(r.price),
    category: r.category,
    category_id: r.category_id,
    description: r.description,
    image_url: r.image_url,
    availability: !!r.availability,
    updated_at: r.updated_at,
  });

  // ─── Tables ────────────────────────────────────────────────────
  async cacheTables(tables: RestaurantTable[]): Promise<void> {
    if (!tables?.length) return;
    const set = tables.map((t) => ({
      statement: `INSERT OR REPLACE INTO restaurant_tables
        (restaurant_table_id, table_number, label, seats, status, notes, updated_at)
        VALUES (?,?,?,?,?,?,?)`,
      values: [
        t.restaurant_table_id, t.table_number, t.label ?? null, t.seats ?? 4,
        t.status ?? 'available', t.notes ?? null,
        t.updated_at ?? new Date().toISOString(),
      ],
    }));
    await this.db.exec(set);
  }

  async upsertTable(t: RestaurantTable): Promise<void> {
    await this.cacheTables([t]);
  }

  async listTables(): Promise<RestaurantTable[]> {
    const rows = await this.db.query<any>('SELECT * FROM restaurant_tables ORDER BY table_number');
    const tables = rows.map(this.toTable);
    for (const t of tables) {
      t.active_order = await this.activeOrderForTable(t.restaurant_table_id);
    }
    return tables;
  }

  async getTable(id: number): Promise<RestaurantTable | null> {
    const rows = await this.db.query<any>(
      'SELECT * FROM restaurant_tables WHERE restaurant_table_id = ? LIMIT 1', [id],
    );
    if (!rows[0]) return null;
    const t = this.toTable(rows[0]);
    t.active_order = await this.activeOrderForTable(t.restaurant_table_id);
    return t;
  }

  async deleteTable(id: number): Promise<void> {
    await this.db.run('DELETE FROM restaurant_tables WHERE restaurant_table_id = ?', [id]);
  }

  private toTable = (r: any): RestaurantTable => ({
    restaurant_table_id: r.restaurant_table_id,
    table_number: r.table_number,
    label: r.label,
    seats: r.seats ?? 4,
    status: r.status ?? 'available',
    notes: r.notes,
    updated_at: r.updated_at,
  });

  // ─── Orders ────────────────────────────────────────────────────
  /**
   * Server-pushed orders get a stable local_uuid of `srv-{order_id}` so
   * we don't need a separate lookup index when reconciling.
   */
  uuidForServerOrder(id: number): string { return `srv-${id}`; }

  async upsertOrder(o: Order, opts: { localUuid?: string } = {}): Promise<string> {
    const localUuid = opts.localUuid ?? this.uuidForServerOrder(o.order_id);
    await this.db.run(
      `INSERT OR REPLACE INTO orders
        (local_uuid, order_id, order_number, restaurant_table_id, subtotal,
         total_amount, payment_status, notes, items_count, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        localUuid, o.order_id ?? null, o.order_number ?? null,
        o.restaurant_table_id, o.subtotal ?? 0, o.total_amount ?? 0,
        o.payment_status ?? 'not_yet_paid', o.notes ?? null,
        o.items_count ?? (o.items?.length ?? 0),
        o.created_at ?? new Date().toISOString(),
        o.updated_at ?? new Date().toISOString(),
      ],
    );
    if (o.items?.length) {
      // Replace items wholesale to keep the local order in sync with server truth.
      await this.db.run('DELETE FROM order_items WHERE order_local_uuid = ?', [localUuid]);
      const set = o.items.map((it, idx) => ({
        statement: `INSERT INTO order_items
          (local_uuid, order_item_id, order_local_uuid, menu_item_id, item_name,
           price, quantity, subtotal, notes, created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?)`,
        values: [
          it.order_item_id ? `srv-oi-${it.order_item_id}` : `${localUuid}-${idx}-${Date.now()}`,
          it.order_item_id ?? null, localUuid, it.menu_item_id, it.item_name,
          it.price ?? 0, it.quantity, it.subtotal ?? (it.price * it.quantity),
          it.notes ?? null, new Date().toISOString(),
        ],
      }));
      if (set.length) await this.db.exec(set);
    }
    return localUuid;
  }

  /** Returns the unpaid order at a table, or null. Prefers server-acknowledged rows. */
  async activeOrderForTable(tableId: number): Promise<Order | null> {
    const rows = await this.db.query<any>(
      `SELECT * FROM orders
        WHERE restaurant_table_id = ? AND payment_status = 'not_yet_paid'
        ORDER BY (order_id IS NULL) ASC, created_at DESC
        LIMIT 1`,
      [tableId],
    );
    if (!rows[0]) return null;
    return this.hydrateOrder(rows[0]);
  }

  async getOrderByLocalUuid(localUuid: string): Promise<Order | null> {
    const rows = await this.db.query<any>(
      'SELECT * FROM orders WHERE local_uuid = ? LIMIT 1', [localUuid],
    );
    return rows[0] ? this.hydrateOrder(rows[0]) : null;
  }

  async getOrderByServerId(orderId: number): Promise<Order | null> {
    const rows = await this.db.query<any>(
      'SELECT * FROM orders WHERE order_id = ? LIMIT 1', [orderId],
    );
    return rows[0] ? this.hydrateOrder(rows[0]) : null;
  }

  async addItemsToOrder(localUuid: string, items: OrderItem[]): Promise<void> {
    if (!items.length) return;
    const set = items.map((it, idx) => ({
      statement: `INSERT INTO order_items
        (local_uuid, order_local_uuid, menu_item_id, item_name, price,
         quantity, subtotal, notes, created_at)
        VALUES (?,?,?,?,?,?,?,?,?)`,
      values: [
        `${localUuid}-${Date.now()}-${idx}`, localUuid, it.menu_item_id, it.item_name,
        it.price ?? 0, it.quantity, it.subtotal ?? (it.price * it.quantity),
        it.notes ?? null, new Date().toISOString(),
      ],
    }));
    await this.db.exec(set);
    await this.recomputeOrderTotal(localUuid);
  }

  async recomputeOrderTotal(localUuid: string): Promise<void> {
    const rows = await this.db.query<any>(
      'SELECT COALESCE(SUM(subtotal),0) AS total, COUNT(*) AS cnt FROM order_items WHERE order_local_uuid = ?',
      [localUuid],
    );
    const total = Number(rows[0]?.total ?? 0);
    const cnt = Number(rows[0]?.cnt ?? 0);
    await this.db.run(
      `UPDATE orders SET subtotal = ?, total_amount = ?, items_count = ?, updated_at = ?
         WHERE local_uuid = ?`,
      [total, total, cnt, new Date().toISOString(), localUuid],
    );
  }

  async markOrderCancelled(localUuid: string): Promise<void> {
    await this.db.run(
      `UPDATE orders SET payment_status = 'cancelled', updated_at = ? WHERE local_uuid = ?`,
      [new Date().toISOString(), localUuid],
    );
  }

  async markOrderPaid(localUuid: string): Promise<void> {
    await this.db.run(
      `UPDATE orders SET payment_status = 'paid', updated_at = ? WHERE local_uuid = ?`,
      [new Date().toISOString(), localUuid],
    );
  }

  async setOrderServerId(localUuid: string, orderId: number, orderNumber?: string): Promise<void> {
    await this.db.run(
      `UPDATE orders SET order_id = ?, order_number = COALESCE(?, order_number), updated_at = ?
         WHERE local_uuid = ?`,
      [orderId, orderNumber ?? null, new Date().toISOString(), localUuid],
    );
  }

  private async hydrateOrder(row: any): Promise<Order> {
    const items = await this.db.query<any>(
      'SELECT * FROM order_items WHERE order_local_uuid = ? ORDER BY created_at',
      [row.local_uuid],
    );
    return {
      // Use the server id when known; otherwise expose 0 so the UI's `*ngIf`
      // checks still work. Call sites that need to mutate should use
      // `local_uuid` (read off the cached row) — see service wrappers.
      order_id: row.order_id ?? 0,
      order_number: row.order_number ?? `OFFLINE-${row.local_uuid.slice(0, 6)}`,
      restaurant_table_id: row.restaurant_table_id,
      subtotal: Number(row.subtotal),
      total_amount: Number(row.total_amount),
      payment_status: row.payment_status,
      notes: row.notes,
      items_count: row.items_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
      items: items.map((it: any): OrderItem => ({
        order_item_id: it.order_item_id ?? undefined,
        menu_item_id: it.menu_item_id,
        item_name: it.item_name,
        price: Number(it.price),
        quantity: it.quantity,
        subtotal: Number(it.subtotal),
        notes: it.notes,
      })),
      // Stashed so call sites can read the local id without a second lookup.
      // Not part of the public Order interface — accessed via `as any`.
      ...({ _local_uuid: row.local_uuid } as any),
    };
  }

  // ─── Payments ──────────────────────────────────────────────────
  async upsertPayment(p: Payment, opts: { localUuid?: string; orderLocalUuid?: string } = {}): Promise<string> {
    const localUuid = opts.localUuid ?? `srv-pay-${p.payment_id}`;
    await this.db.run(
      `INSERT OR REPLACE INTO payments
        (local_uuid, payment_id, order_id, order_local_uuid, total_amount,
         cash_received, change_amount, payment_method, reference, notes,
         payment_date, receipt_json)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        localUuid, p.payment_id ?? null, p.order_id ?? null,
        opts.orderLocalUuid ?? null, p.total_amount ?? 0, p.cash_received ?? 0,
        p.change_amount ?? 0, p.payment_method ?? 'cash',
        p.reference ?? null, p.notes ?? null,
        p.payment_date ?? new Date().toISOString(),
        p.receipt ? JSON.stringify(p.receipt) : null,
      ],
    );
    return localUuid;
  }

  async getPaymentByLocalUuid(localUuid: string): Promise<Payment | null> {
    const rows = await this.db.query<any>(
      'SELECT * FROM payments WHERE local_uuid = ? LIMIT 1', [localUuid],
    );
    if (!rows[0]) return null;
    return this.toPayment(rows[0]);
  }

  async setPaymentServerId(localUuid: string, paymentId: number): Promise<void> {
    await this.db.run(
      'UPDATE payments SET payment_id = ? WHERE local_uuid = ?',
      [paymentId, localUuid],
    );
  }

  private toPayment(r: any): Payment {
    return {
      payment_id: r.payment_id ?? 0,
      order_id: r.order_id ?? 0,
      total_amount: Number(r.total_amount),
      cash_received: Number(r.cash_received),
      change_amount: Number(r.change_amount),
      payment_method: r.payment_method,
      reference: r.reference,
      notes: r.notes,
      payment_date: r.payment_date,
      receipt: r.receipt_json ? JSON.parse(r.receipt_json) : undefined,
    };
  }
}
