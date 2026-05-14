import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';

const DB_NAME = 'baligya_offline';
const DB_VERSION = 2;

/**
 * Thin wrapper around @capacitor-community/sqlite. Owns the single DB
 * connection used by the offline layer and runs schema migrations on
 * startup. On web we no-op — the offline layer is Android-only by
 * design (see plan in this PR), so `ng serve` still works.
 */
@Injectable({ providedIn: 'root' })
export class SqliteService {
  private sqlite = new SQLiteConnection(CapacitorSQLite);
  private db?: SQLiteDBConnection;
  private ready?: Promise<void>;

  get isNative(): boolean {
    return Capacitor.getPlatform() !== 'web';
  }

  /** Idempotent: safe to call from multiple call sites. */
  init(): Promise<void> {
    if (!this.isNative) return Promise.resolve();
    if (!this.ready) this.ready = this.boot();
    return this.ready;
  }

  private async boot(): Promise<void> {
    const exists = await this.sqlite.isConnection(DB_NAME, false);
    this.db = exists.result
      ? await this.sqlite.retrieveConnection(DB_NAME, false)
      : await this.sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false);

    await this.db.open();
    await this.runMigrations();
  }

  private async runMigrations(): Promise<void> {
    // Schema is idempotent (IF NOT EXISTS). Bump DB_VERSION + add ALTERs here
    // when the shape changes.
    const statements = [
      `CREATE TABLE IF NOT EXISTS menu_items (
        menu_item_id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL DEFAULT 0,
        category TEXT,
        category_id INTEGER,
        description TEXT,
        image_url TEXT,
        availability INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS restaurant_tables (
        restaurant_table_id INTEGER PRIMARY KEY,
        table_number INTEGER NOT NULL,
        label TEXT,
        seats INTEGER NOT NULL DEFAULT 4,
        status TEXT NOT NULL DEFAULT 'available',
        notes TEXT,
        updated_at TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS orders (
        local_uuid TEXT PRIMARY KEY,
        order_id INTEGER,
        order_number TEXT,
        restaurant_table_id INTEGER,
        restaurant_table_local_uuid TEXT,
        subtotal REAL NOT NULL DEFAULT 0,
        total_amount REAL NOT NULL DEFAULT 0,
        payment_status TEXT NOT NULL DEFAULT 'not_yet_paid',
        notes TEXT,
        items_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT,
        updated_at TEXT
      );`,
      `CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(restaurant_table_id);`,
      `CREATE INDEX IF NOT EXISTS idx_orders_server_id ON orders(order_id);`,
      `CREATE TABLE IF NOT EXISTS order_items (
        local_uuid TEXT PRIMARY KEY,
        order_item_id INTEGER,
        order_local_uuid TEXT NOT NULL,
        menu_item_id INTEGER NOT NULL,
        item_name TEXT NOT NULL,
        price REAL NOT NULL DEFAULT 0,
        quantity INTEGER NOT NULL DEFAULT 1,
        subtotal REAL NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT
      );`,
      `CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_local_uuid);`,
      `CREATE TABLE IF NOT EXISTS payments (
        local_uuid TEXT PRIMARY KEY,
        payment_id INTEGER,
        order_id INTEGER,
        order_local_uuid TEXT,
        total_amount REAL NOT NULL DEFAULT 0,
        cash_received REAL NOT NULL DEFAULT 0,
        change_amount REAL NOT NULL DEFAULT 0,
        payment_method TEXT NOT NULL DEFAULT 'cash',
        reference TEXT,
        notes TEXT,
        payment_date TEXT,
        receipt_json TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity TEXT NOT NULL,
        op TEXT NOT NULL,
        local_uuid TEXT,
        payload TEXT NOT NULL,
        depends_on TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT
      );`,
      `CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status, id);`,

      // ─── v2: retail POS offline cache + outbox ──────────────────
      `CREATE TABLE IF NOT EXISTS products_cache (
        product_id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        sku TEXT,
        barcode TEXT,
        price REAL NOT NULL DEFAULT 0,
        cost_price REAL NOT NULL DEFAULT 0,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        reorder_level INTEGER NOT NULL DEFAULT 0,
        category_id INTEGER,
        supplier_id INTEGER,
        image_url TEXT,
        expiration_date TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT,
        payload TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_products_cache_barcode ON products_cache(barcode);`,
      `CREATE INDEX IF NOT EXISTS idx_products_cache_sku ON products_cache(sku);`,
      `CREATE TABLE IF NOT EXISTS categories_cache (
        category_id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        payload TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS suppliers_cache (
        supplier_id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        payload TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS sale_drafts (
        local_uuid TEXT PRIMARY KEY,
        cart_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
    ];

    for (const sql of statements) {
      await this.db!.execute(sql);
    }
  }

  /** SELECT helper. Returns the `values` array (rows). */
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.isNative) return [];
    await this.init();
    const res = await this.db!.query(sql, params);
    return (res.values ?? []) as T[];
  }

  /** INSERT/UPDATE/DELETE helper. */
  async run(sql: string, params: any[] = []): Promise<void> {
    if (!this.isNative) return;
    await this.init();
    await this.db!.run(sql, params);
  }

  /** Run multiple statements atomically. Each item is { statement, values }. */
  async exec(set: { statement: string; values?: any[] }[]): Promise<void> {
    if (!this.isNative) return;
    await this.init();
    await this.db!.executeSet(set as any, true);
  }
}
