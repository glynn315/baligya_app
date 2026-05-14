import { inject, Injectable } from '@angular/core';

import { Category, Product, Supplier } from '../../models/api.models';
import { SqliteService } from './sqlite.service';

/**
 * SQLite-backed repository for the retail POS catalog: cached products,
 * categories, suppliers. Mirrors the role of EateryRepoService but for the
 * (products / sales / inventory) flow. Schema lives in SqliteService at v2.
 */
@Injectable({ providedIn: 'root' })
export class PosRepoService {
  private readonly db = inject(SqliteService);

  // ─── Products ──────────────────────────────────────────────────
  async cacheProducts(items: Product[]): Promise<void> {
    if (!items?.length) return;
    const set = items.map((p) => ({
      statement: `INSERT OR REPLACE INTO products_cache
        (product_id, name, sku, barcode, price, cost_price, stock_quantity,
         reorder_level, category_id, supplier_id, image_url, expiration_date,
         is_active, updated_at, payload)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      values: [
        p.id, p.name, p.sku ?? null, p.barcode ?? null,
        p.price, p.cost_price, p.stock_quantity, p.reorder_level,
        p.category_id ?? null, p.supplier_id ?? null, p.image_url ?? null,
        p.expiration_date ?? null, p.is_active ? 1 : 0,
        p.updated_at ?? new Date().toISOString(),
        JSON.stringify(p),
      ],
    }));
    await this.db.exec(set);
  }

  async upsertProduct(p: Product): Promise<void> {
    await this.cacheProducts([p]);
  }

  async listProducts(): Promise<Product[]> {
    const rows = await this.db.query<any>('SELECT payload FROM products_cache ORDER BY name');
    return rows.map((r) => this.hydrate<Product>(r.payload));
  }

  async getProduct(id: number): Promise<Product | null> {
    const rows = await this.db.query<any>(
      'SELECT payload FROM products_cache WHERE product_id = ? LIMIT 1', [id],
    );
    return rows[0] ? this.hydrate<Product>(rows[0].payload) : null;
  }

  async getProductByBarcode(barcode: string): Promise<Product | null> {
    const rows = await this.db.query<any>(
      'SELECT payload FROM products_cache WHERE barcode = ? LIMIT 1', [barcode],
    );
    return rows[0] ? this.hydrate<Product>(rows[0].payload) : null;
  }

  async deleteProduct(id: number): Promise<void> {
    await this.db.run('DELETE FROM products_cache WHERE product_id = ?', [id]);
  }

  // ─── Categories ────────────────────────────────────────────────
  async cacheCategories(items: Category[]): Promise<void> {
    if (!items?.length) return;
    const set = items.map((c) => ({
      statement: `INSERT OR REPLACE INTO categories_cache
        (category_id, name, description, payload)
        VALUES (?,?,?,?)`,
      values: [c.id, c.name, c.description ?? null, JSON.stringify(c)],
    }));
    await this.db.exec(set);
  }

  async listCategories(): Promise<Category[]> {
    const rows = await this.db.query<any>('SELECT payload FROM categories_cache ORDER BY name');
    return rows.map((r) => this.hydrate<Category>(r.payload));
  }

  // ─── Suppliers ─────────────────────────────────────────────────
  async cacheSuppliers(items: Supplier[]): Promise<void> {
    if (!items?.length) return;
    const set = items.map((s) => ({
      statement: `INSERT OR REPLACE INTO suppliers_cache
        (supplier_id, name, is_active, payload)
        VALUES (?,?,?,?)`,
      values: [s.id, s.name, s.is_active ? 1 : 0, JSON.stringify(s)],
    }));
    await this.db.exec(set);
  }

  async listSuppliers(): Promise<Supplier[]> {
    const rows = await this.db.query<any>(
      `SELECT payload FROM suppliers_cache WHERE is_active = 1 ORDER BY name`,
    );
    return rows.map((r) => this.hydrate<Supplier>(r.payload));
  }

  // ─── Sales drafts (cart snapshots while offline) ───────────────
  async saveSaleDraft(localUuid: string, cartJson: string): Promise<void> {
    await this.db.run(
      `INSERT OR REPLACE INTO sale_drafts (local_uuid, cart_json, created_at, updated_at)
       VALUES (?,?,?,?)`,
      [localUuid, cartJson, new Date().toISOString(), new Date().toISOString()],
    );
  }

  async listSaleDrafts(): Promise<{ local_uuid: string; cart_json: string; updated_at: string }[]> {
    return this.db.query<any>(
      `SELECT local_uuid, cart_json, updated_at FROM sale_drafts ORDER BY updated_at DESC`,
    );
  }

  async deleteSaleDraft(localUuid: string): Promise<void> {
    await this.db.run('DELETE FROM sale_drafts WHERE local_uuid = ?', [localUuid]);
  }

  // ─── Helpers ───────────────────────────────────────────────────
  private hydrate<T>(payload: any): T {
    return typeof payload === 'string' ? (JSON.parse(payload) as T) : (payload as T);
  }
}
