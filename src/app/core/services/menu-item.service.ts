import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, from, map, Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse, MenuItem } from '../models/api.models';
import { EateryRepoService } from './offline/eatery-repo.service';
import { NetworkService } from './offline/network.service';
import { OutboxService } from './offline/outbox.service';

export interface ListMenuParams {
  availability?: boolean | string;
  category?: string;
  search?: string;
}

export interface CreateMenuItemDto {
  name: string;
  price: number;
  category?: string | null;
  category_id?: number | null;
  description?: string | null;
  image_url?: string | null;
  availability?: boolean;
}

export interface UpdateMenuItemDto {
  name?: string;
  price?: number;
  category?: string | null;
  category_id?: number | null;
  description?: string | null;
  image_url?: string | null;
  availability?: boolean;
}

/**
 * Offline-aware menu CRUD. Reads return cached rows when offline (or
 * when the API errors). Writes are mirrored to SQLite and enqueued for
 * the sync engine; the optimistic row uses a negative temp id so it
 * doesn't clash with future server-issued ids.
 */
@Injectable({ providedIn: 'root' })
export class MenuItemService {
  private readonly http = inject(HttpClient);
  private readonly repo = inject(EateryRepoService);
  private readonly network = inject(NetworkService);
  private readonly outbox = inject(OutboxService);
  private readonly base = `${environment.apiBaseUrl}/eatery/menu`;

  list(params: ListMenuParams = {}): Observable<ApiResponse<MenuItem[]>> {
    if (!this.network.online()) {
      return from(this.repo.listMenuItems()).pipe(map((data) => this.cachedFilter(data, params)));
    }
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => v != null && v !== '' && (p = p.set(k, String(v))));
    return this.http.get<ApiResponse<MenuItem[]>>(this.base, { params: p }).pipe(
      tap((res) => { if (res?.data) void this.repo.cacheMenuItems(res.data); }),
      catchError(() => from(this.repo.listMenuItems()).pipe(map((data) => this.cachedFilter(data, params)))),
    );
  }

  get(id: number): Observable<ApiResponse<MenuItem>> {
    if (!this.network.online()) {
      return from(this.repo.getMenuItem(id)).pipe(map((data) => this.wrap(data!)));
    }
    return this.http.get<ApiResponse<MenuItem>>(`${this.base}/${id}`).pipe(
      tap((res) => { if (res?.data) void this.repo.upsertMenuItem(res.data); }),
      catchError(() => from(this.repo.getMenuItem(id)).pipe(map((data) => this.wrap(data!)))),
    );
  }

  create(payload: CreateMenuItemDto): Observable<ApiResponse<MenuItem>> {
    if (this.network.online()) {
      return this.http.post<ApiResponse<MenuItem>>(this.base, payload).pipe(
        tap((res) => { if (res?.data) void this.repo.upsertMenuItem(res.data); }),
        catchError(() => from(this.enqueueCreate(payload)).pipe(map((data) => this.wrap(data)))),
      );
    }
    return from(this.enqueueCreate(payload)).pipe(map((data) => this.wrap(data)));
  }

  update(id: number, payload: UpdateMenuItemDto): Observable<ApiResponse<MenuItem>> {
    if (this.network.online()) {
      return this.http.put<ApiResponse<MenuItem>>(`${this.base}/${id}`, payload).pipe(
        tap((res) => { if (res?.data) void this.repo.upsertMenuItem(res.data); }),
        catchError(() => from(this.enqueueUpdate(id, payload)).pipe(map((data) => this.wrap(data)))),
      );
    }
    return from(this.enqueueUpdate(id, payload)).pipe(map((data) => this.wrap(data)));
  }

  delete(id: number): Observable<ApiResponse<null>> {
    if (this.network.online()) {
      return this.http.delete<ApiResponse<null>>(`${this.base}/${id}`).pipe(
        tap(() => void this.repo.deleteMenuItem(id)),
        catchError(() => from(this.enqueueDelete(id)).pipe(map(() => this.wrap(null as any)))),
      );
    }
    return from(this.enqueueDelete(id)).pipe(map(() => this.wrap(null as any)));
  }

  // ─── helpers ──────────────────────────────────────────────────
  private async enqueueCreate(payload: CreateMenuItemDto): Promise<MenuItem> {
    const tempId = -Date.now();
    const item: MenuItem = {
      menu_item_id: tempId,
      name: payload.name,
      price: payload.price,
      category: payload.category ?? null,
      category_id: payload.category_id ?? null,
      description: payload.description ?? null,
      image_url: payload.image_url ?? null,
      availability: payload.availability ?? true,
    };
    await this.repo.upsertMenuItem(item);
    await this.outbox.enqueue('menu_item', 'create', { ...payload, _temp_id: tempId });
    return item;
  }

  private async enqueueUpdate(id: number, payload: UpdateMenuItemDto): Promise<MenuItem> {
    const current = await this.repo.getMenuItem(id);
    const merged: MenuItem = { ...(current as MenuItem), ...payload, menu_item_id: id };
    await this.repo.upsertMenuItem(merged);
    await this.outbox.enqueue('menu_item', 'update', { _id: id, ...payload });
    return merged;
  }

  private async enqueueDelete(id: number): Promise<void> {
    await this.repo.deleteMenuItem(id);
    await this.outbox.enqueue('menu_item', 'delete', { _id: id });
  }

  private cachedFilter(data: MenuItem[], params: ListMenuParams): ApiResponse<MenuItem[]> {
    let rows = data;
    if (params.availability != null) {
      const want = params.availability === true || params.availability === 'true';
      rows = rows.filter((m) => !!m.availability === want);
    }
    if (params.category) rows = rows.filter((m) => m.category === params.category);
    if (params.search) {
      const q = String(params.search).toLowerCase();
      rows = rows.filter((m) => m.name.toLowerCase().includes(q));
    }
    return { success: true, message: 'cached', data: rows };
  }

  private wrap<T>(data: T): ApiResponse<T> {
    return { success: true, message: 'queued', data };
  }
}
