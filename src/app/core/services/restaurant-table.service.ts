import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, from, map, Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse, Order, RestaurantTable } from '../models/api.models';
import { EateryRepoService } from './offline/eatery-repo.service';
import { NetworkService } from './offline/network.service';
import { OutboxService } from './offline/outbox.service';

export interface ListTablesParams {
  status?: string;
  search?: string;
}

export interface CreateTableDto {
  table_number: number;
  label?: string | null;
  seats?: number | null;
  notes?: string | null;
}

export interface UpdateTableDto {
  table_number?: number;
  label?: string | null;
  seats?: number;
  status?: string;
  notes?: string | null;
}

/**
 * Offline-aware table CRUD. Same pattern as menu items: cache reads,
 * mirror + enqueue writes, optimistic temp ids for offline creates.
 */
@Injectable({ providedIn: 'root' })
export class RestaurantTableService {
  private readonly http = inject(HttpClient);
  private readonly repo = inject(EateryRepoService);
  private readonly network = inject(NetworkService);
  private readonly outbox = inject(OutboxService);
  private readonly base = `${environment.apiBaseUrl}/eatery/tables`;

  list(params: ListTablesParams = {}): Observable<ApiResponse<RestaurantTable[]>> {
    if (!this.network.online()) {
      return from(this.repo.listTables()).pipe(map((data) => this.wrap(data)));
    }
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => v != null && v !== '' && (p = p.set(k, String(v))));
    return this.http.get<ApiResponse<RestaurantTable[]>>(this.base, { params: p }).pipe(
      tap((res) => {
        if (res?.data) {
          void this.repo.cacheTables(res.data);
          for (const t of res.data) {
            if (t.active_order) void this.repo.upsertOrder(t.active_order);
          }
        }
      }),
      catchError(() => from(this.repo.listTables()).pipe(map((data) => this.wrap(data)))),
    );
  }

  get(id: number): Observable<ApiResponse<RestaurantTable>> {
    if (!this.network.online()) {
      return from(this.repo.getTable(id)).pipe(map((data) => this.wrap(data!)));
    }
    return this.http.get<ApiResponse<RestaurantTable>>(`${this.base}/${id}`).pipe(
      tap((res) => {
        if (res?.data) {
          void this.repo.upsertTable(res.data);
          if (res.data.active_order) void this.repo.upsertOrder(res.data.active_order);
        }
      }),
      catchError(() => from(this.repo.getTable(id)).pipe(map((data) => this.wrap(data!)))),
    );
  }

  create(payload: CreateTableDto): Observable<ApiResponse<RestaurantTable>> {
    if (this.network.online()) {
      return this.http.post<ApiResponse<RestaurantTable>>(this.base, payload).pipe(
        tap((res) => { if (res?.data) void this.repo.upsertTable(res.data); }),
        catchError(() => from(this.enqueueCreate(payload)).pipe(map((data) => this.wrap(data)))),
      );
    }
    return from(this.enqueueCreate(payload)).pipe(map((data) => this.wrap(data)));
  }

  update(id: number, payload: UpdateTableDto): Observable<ApiResponse<RestaurantTable>> {
    if (this.network.online()) {
      return this.http.put<ApiResponse<RestaurantTable>>(`${this.base}/${id}`, payload).pipe(
        tap((res) => { if (res?.data) void this.repo.upsertTable(res.data); }),
        catchError(() => from(this.enqueueUpdate(id, payload)).pipe(map((data) => this.wrap(data)))),
      );
    }
    return from(this.enqueueUpdate(id, payload)).pipe(map((data) => this.wrap(data)));
  }

  delete(id: number): Observable<ApiResponse<null>> {
    if (this.network.online()) {
      return this.http.delete<ApiResponse<null>>(`${this.base}/${id}`).pipe(
        tap(() => void this.repo.deleteTable(id)),
        catchError(() => from(this.enqueueDelete(id)).pipe(map(() => this.wrap(null as any)))),
      );
    }
    return from(this.enqueueDelete(id)).pipe(map(() => this.wrap(null as any)));
  }

  activeOrder(id: number): Observable<ApiResponse<Order | null>> {
    if (!this.network.online()) {
      return from(this.repo.activeOrderForTable(id)).pipe(map((data) => this.wrap(data)));
    }
    return this.http.get<ApiResponse<Order | null>>(`${this.base}/${id}/active-order`).pipe(
      tap((res) => { if (res?.data) void this.repo.upsertOrder(res.data); }),
      catchError(() => from(this.repo.activeOrderForTable(id)).pipe(map((data) => this.wrap(data)))),
    );
  }

  // These two are server-side maintenance endpoints — return empty when offline.
  anomalies(): Observable<ApiResponse<{ count: number; anomalies: any[] }>> {
    if (!this.network.online()) {
      return from(Promise.resolve(this.wrap({ count: 0, anomalies: [] })));
    }
    return this.http.get<ApiResponse<{ count: number; anomalies: any[] }>>(`${this.base}/anomalies`);
  }

  syncStatuses(): Observable<ApiResponse<{ detected: number; healed: number }>> {
    if (!this.network.online()) {
      return from(Promise.resolve(this.wrap({ detected: 0, healed: 0 })));
    }
    return this.http.post<ApiResponse<{ detected: number; healed: number }>>(`${this.base}/sync-statuses`, {});
  }

  // ─── helpers ──────────────────────────────────────────────────
  private async enqueueCreate(payload: CreateTableDto): Promise<RestaurantTable> {
    const tempId = -Date.now();
    const table: RestaurantTable = {
      restaurant_table_id: tempId,
      table_number: payload.table_number,
      label: payload.label ?? null,
      seats: payload.seats ?? 4,
      status: 'available',
      notes: payload.notes ?? null,
    };
    await this.repo.upsertTable(table);
    await this.outbox.enqueue('restaurant_table', 'create', { ...payload, _temp_id: tempId });
    return table;
  }

  private async enqueueUpdate(id: number, payload: UpdateTableDto): Promise<RestaurantTable> {
    const current = await this.repo.getTable(id);
    const merged: RestaurantTable = { ...(current as RestaurantTable), ...payload, restaurant_table_id: id };
    await this.repo.upsertTable(merged);
    await this.outbox.enqueue('restaurant_table', 'update', { _id: id, ...payload });
    return merged;
  }

  private async enqueueDelete(id: number): Promise<void> {
    await this.repo.deleteTable(id);
    await this.outbox.enqueue('restaurant_table', 'delete', { _id: id });
  }

  private wrap<T>(data: T): ApiResponse<T> {
    return { success: true, message: 'cached', data };
  }
}
