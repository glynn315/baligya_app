import { inject, Injectable, signal } from '@angular/core';

import { SqliteService } from './sqlite.service';

export type OutboxEntity =
  | 'menu_item'
  | 'restaurant_table'
  | 'order'
  | 'order_items'
  | 'payment'
  | 'order_cancel'
  // ─── Retail POS / Inventory (v2) ────────────────────────────
  | 'product'
  | 'supplier'
  | 'sale_create'
  | 'sale_commit'
  | 'sale_refund'
  | 'sale_void'
  | 'inventory_adjust';

export type OutboxOp = 'create' | 'update' | 'delete';

export interface OutboxRow {
  id: number;
  entity: OutboxEntity;
  op: OutboxOp;
  local_uuid: string | null;
  payload: any;
  depends_on: string | null;
  attempts: number;
  last_error: string | null;
  status: 'pending' | 'processing' | 'failed' | 'done';
  created_at: string;
  updated_at: string | null;
}

/**
 * Append-only queue of mutations to replay against the API. The sync
 * engine drains it FIFO; rows that fail past `maxAttempts` are marked
 * `failed` and left for inspection rather than dropped.
 */
@Injectable({ providedIn: 'root' })
export class OutboxService {
  private readonly db = inject(SqliteService);

  /** Reactive count of pending rows — drives the "syncing N" badge. */
  readonly pendingCount = signal(0);

  async enqueue(
    entity: OutboxEntity,
    op: OutboxOp,
    payload: any,
    opts: { localUuid?: string; dependsOn?: string } = {},
  ): Promise<number> {
    await this.db.run(
      `INSERT INTO outbox
        (entity, op, local_uuid, payload, depends_on, attempts, status, created_at)
        VALUES (?,?,?,?,?,?,?,?)`,
      [
        entity, op, opts.localUuid ?? null, JSON.stringify(payload),
        opts.dependsOn ?? null, 0, 'pending', new Date().toISOString(),
      ],
    );
    await this.refreshPending();
    const rows = await this.db.query<any>('SELECT last_insert_rowid() AS id');
    return Number(rows[0]?.id ?? 0);
  }

  async listPending(limit = 50): Promise<OutboxRow[]> {
    const rows = await this.db.query<any>(
      `SELECT * FROM outbox WHERE status = 'pending' ORDER BY id ASC LIMIT ?`,
      [limit],
    );
    return rows.map(this.hydrate);
  }

  async markProcessing(id: number): Promise<void> {
    await this.db.run(
      `UPDATE outbox SET status = 'processing', updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), id],
    );
  }

  async markDone(id: number): Promise<void> {
    await this.db.run(
      `UPDATE outbox SET status = 'done', updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), id],
    );
    await this.refreshPending();
  }

  async markFailed(id: number, error: string, opts: { permanent: boolean }): Promise<void> {
    await this.db.run(
      `UPDATE outbox
         SET status = ?, attempts = attempts + 1, last_error = ?, updated_at = ?
       WHERE id = ?`,
      [
        opts.permanent ? 'failed' : 'pending', error.slice(0, 500),
        new Date().toISOString(), id,
      ],
    );
    await this.refreshPending();
  }

  /**
   * Rewrites every row whose `depends_on` matches the old local UUID to
   * carry the new server identity (`srv-{id}`). Used after an order is
   * created server-side so dependent rows (add-items, payment, cancel)
   * still find their parent.
   */
  async rewriteDependency(oldLocalUuid: string, newLocalUuid: string): Promise<void> {
    await this.db.run(
      `UPDATE outbox SET depends_on = ? WHERE depends_on = ? AND status IN ('pending', 'processing')`,
      [newLocalUuid, oldLocalUuid],
    );
  }

  async refreshPending(): Promise<void> {
    const rows = await this.db.query<any>(
      `SELECT COUNT(*) AS n FROM outbox WHERE status = 'pending'`,
    );
    this.pendingCount.set(Number(rows[0]?.n ?? 0));
  }

  private hydrate = (r: any): OutboxRow => ({
    id: r.id,
    entity: r.entity,
    op: r.op,
    local_uuid: r.local_uuid,
    payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
    depends_on: r.depends_on,
    attempts: r.attempts,
    last_error: r.last_error,
    status: r.status,
    created_at: r.created_at,
    updated_at: r.updated_at,
  });
}
