import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, from, map, Observable, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse, Category, Paginated, Product } from '../models/api.models';
import { NetworkService } from './offline/network.service';
import { OutboxService } from './offline/outbox.service';
import { PosRepoService } from './offline/pos-repo.service';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly network = inject(NetworkService);
  private readonly outbox = inject(OutboxService);
  private readonly repo = inject(PosRepoService);
  private readonly base = environment.apiBaseUrl;

  list(params: { search?: string; category_id?: number; per_page?: number; page?: number } = {}) {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => v != null && (p = p.set(k, String(v))));
    return this.http.get<ApiResponse<Paginated<Product>> | Paginated<Product>>(
      `${this.base}/products`, { params: p },
    );
  }

  pricelist(): Observable<ApiResponse<Product[]>> {
    if (!this.network.online()) {
      return from(this.repo.listProducts()).pipe(
        map((data) => ({ success: true, message: 'cached', data })),
      );
    }
    return this.http.get<ApiResponse<Product[]>>(`${this.base}/products/pricelist`).pipe(
      tap((res) => { if (res?.data) void this.repo.cacheProducts(res.data); }),
      catchError(() => from(this.repo.listProducts()).pipe(
        map((data) => ({ success: true, message: 'cached', data })),
      )),
    );
  }

  lowStock(): Observable<ApiResponse<Product[]>> {
    return this.http.get<ApiResponse<Product[]>>(`${this.base}/products/low-stock`);
  }

  get(id: number): Observable<ApiResponse<Product>> {
    if (!this.network.online()) {
      return from(this.repo.getProduct(id)).pipe(
        map((data) => ({ success: true, message: 'cached', data: data ?? undefined })),
      );
    }
    return this.http.get<ApiResponse<Product>>(`${this.base}/products/${id}`).pipe(
      tap((res) => { if (res?.data) void this.repo.upsertProduct(res.data); }),
    );
  }

  /**
   * Look up by barcode. Returns ApiResponse with data=null on 404 so call
   * sites can show a "create product?" prompt instead of an error.
   */
  findByBarcode(code: string): Observable<ApiResponse<Product | null>> {
    const c = encodeURIComponent(code);
    if (!this.network.online()) {
      return from(this.repo.getProductByBarcode(code)).pipe(
        map((data) => ({ success: !!data, message: data ? 'cached' : 'not found', data: data ?? null })),
      );
    }
    return this.http.get<ApiResponse<Product>>(`${this.base}/products/barcode/${c}`).pipe(
      tap((res) => { if (res?.data) void this.repo.upsertProduct(res.data); }),
      catchError((err) => {
        if (err?.status === 404) return of({ success: false, message: 'Product not found', data: null });
        // On network error, fall back to local cache.
        return from(this.repo.getProductByBarcode(code)).pipe(
          map((data) => ({ success: !!data, message: data ? 'cached' : 'not found', data: data ?? null })),
        );
      }),
    );
  }

  create(payload: Partial<Product>): Observable<ApiResponse<Product>> {
    if (this.network.online()) {
      return this.http.post<ApiResponse<Product>>(`${this.base}/products`, payload).pipe(
        tap((res) => { if (res?.data) void this.repo.upsertProduct(res.data); }),
      );
    }
    return from(this.enqueueCreate(payload)).pipe(
      map((data) => ({ success: true, message: 'queued', data })),
    );
  }

  update(id: number, payload: Partial<Product>): Observable<ApiResponse<Product>> {
    if (this.network.online()) {
      return this.http.put<ApiResponse<Product>>(`${this.base}/products/${id}`, payload).pipe(
        tap((res) => { if (res?.data) void this.repo.upsertProduct(res.data); }),
      );
    }
    return from(this.enqueueUpdate(id, payload)).pipe(
      map((data) => ({ success: true, message: 'queued', data })),
    );
  }

  destroy(id: number): Observable<ApiResponse<null>> {
    if (this.network.online()) {
      return this.http.delete<ApiResponse<null>>(`${this.base}/products/${id}`);
    }
    return from(this.enqueueDelete(id)).pipe(map(() => ({ success: true, message: 'queued' })));
  }

  // ─── Offline helpers ──────────────────────────────────────────
  private async enqueueCreate(payload: Partial<Product>): Promise<Product> {
    const tempId = -Date.now();
    const item = {
      id: tempId,
      name: payload.name ?? '',
      sku: payload.sku ?? null,
      barcode: payload.barcode ?? null,
      price: payload.price ?? 0,
      cost_price: payload.cost_price ?? 0,
      stock_quantity: payload.stock_quantity ?? 0,
      reorder_level: payload.reorder_level ?? 5,
      category_id: payload.category_id ?? null,
      supplier_id: payload.supplier_id ?? null,
      image_url: payload.image_url ?? null,
      expiration_date: payload.expiration_date ?? null,
      is_active: true,
      is_low_stock: false,
      is_out_of_stock: (payload.stock_quantity ?? 0) <= 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Product;
    await this.repo.upsertProduct(item);
    await this.outbox.enqueue('product', 'create', { ...payload, _temp_id: tempId });
    return item;
  }

  private async enqueueUpdate(id: number, payload: Partial<Product>): Promise<Product> {
    const current = await this.repo.getProduct(id);
    const merged = { ...(current as Product), ...payload, id };
    await this.repo.upsertProduct(merged as Product);
    await this.outbox.enqueue('product', 'update', { _id: id, ...payload });
    return merged as Product;
  }

  private async enqueueDelete(id: number): Promise<void> {
    await this.repo.deleteProduct(id);
    await this.outbox.enqueue('product', 'delete', { _id: id });
  }
}

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly repo = inject(PosRepoService);
  private readonly network = inject(NetworkService);
  private readonly base = environment.apiBaseUrl;

  list(): Observable<ApiResponse<Category[]>> {
    if (!this.network.online()) {
      return from(this.repo.listCategories()).pipe(
        map((data) => ({ success: true, message: 'cached', data })),
      );
    }
    return this.http.get<ApiResponse<Category[]>>(`${this.base}/categories`).pipe(
      tap((res) => { if (res?.data) void this.repo.cacheCategories(res.data); }),
      catchError(() => from(this.repo.listCategories()).pipe(
        map((data) => ({ success: true, message: 'cached', data })),
      )),
    );
  }
  create(payload: Partial<Category>): Observable<ApiResponse<Category>> {
    return this.http.post<ApiResponse<Category>>(`${this.base}/categories`, payload);
  }
  update(id: number, payload: Partial<Category>): Observable<ApiResponse<Category>> {
    return this.http.put<ApiResponse<Category>>(`${this.base}/categories/${id}`, payload);
  }
  destroy(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/categories/${id}`);
  }
}
