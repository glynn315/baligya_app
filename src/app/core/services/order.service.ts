import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, from, map, Observable, tap } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { environment } from '../../../environments/environment';
import {
  AddOrderItemsDto, ApiResponse, CreateOrderDto, Order, OrderItem, Paginated,
} from '../models/api.models';
import { EateryRepoService } from './offline/eatery-repo.service';
import { NetworkService } from './offline/network.service';
import { OutboxService } from './offline/outbox.service';

export interface ListOrdersParams {
  payment_status?: string;
  table_id?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
  per_page?: number;
  page?: number;
}

/**
 * Order ref: either the server-issued numeric id (positive), or a
 * local-only uuid string for orders that haven't synced yet. Page code
 * should pass `order.order_id || (order as any)._local_uuid`.
 */
export type OrderRef = number | string;

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly repo = inject(EateryRepoService);
  private readonly network = inject(NetworkService);
  private readonly outbox = inject(OutboxService);
  private readonly base = `${environment.apiBaseUrl}/eatery/orders`;

  list(params: ListOrdersParams = {}): Observable<ApiResponse<Paginated<Order>> | Paginated<Order>> {
    if (!this.network.online()) {
      // No paginated read off the cache — return whatever local rows we have.
      return from(this.repo.listTables()).pipe(
        map((tables) => {
          const orders = tables
            .map((t) => t.active_order)
            .filter((o): o is Order => !!o);
          return this.wrap(this.fakePaginated(orders));
        }),
      );
    }
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => v != null && v !== '' && (p = p.set(k, String(v))));
    return this.http.get<ApiResponse<Paginated<Order>> | Paginated<Order>>(this.base, { params: p });
  }

  get(id: number): Observable<ApiResponse<Order>> {
    if (!this.network.online()) {
      return from(this.repo.getOrderByServerId(id)).pipe(map((data) => this.wrap(data as Order)));
    }
    return this.http.get<ApiResponse<Order>>(`${this.base}/${id}`).pipe(
      tap((res) => { if (res?.data) void this.repo.upsertOrder(res.data); }),
      catchError(() => from(this.repo.getOrderByServerId(id)).pipe(map((data) => this.wrap(data as Order)))),
    );
  }

  create(payload: CreateOrderDto): Observable<ApiResponse<Order>> {
    if (this.network.online()) {
      return this.http.post<ApiResponse<Order>>(this.base, payload).pipe(
        tap((res) => { if (res?.data) void this.repo.upsertOrder(res.data); }),
        catchError(() => from(this.enqueueCreate(payload)).pipe(map((data) => this.wrap(data)))),
      );
    }
    return from(this.enqueueCreate(payload)).pipe(map((data) => this.wrap(data)));
  }

  /** Accepts either a server order id (number) or a local uuid (string). */
  addItems(ref: OrderRef, payload: AddOrderItemsDto): Observable<ApiResponse<Order>> {
    const isLocalRef = typeof ref === 'string' || (typeof ref === 'number' && ref <= 0);
    if (this.network.online() && !isLocalRef) {
      return this.http.post<ApiResponse<Order>>(`${this.base}/${ref}/items`, payload).pipe(
        tap((res) => { if (res?.data) void this.repo.upsertOrder(res.data); }),
        catchError(() => from(this.enqueueAddItems(ref, payload)).pipe(map((data) => this.wrap(data)))),
      );
    }
    return from(this.enqueueAddItems(ref, payload)).pipe(map((data) => this.wrap(data)));
  }

  cancel(ref: OrderRef): Observable<ApiResponse<Order>> {
    const isLocalRef = typeof ref === 'string' || (typeof ref === 'number' && ref <= 0);
    if (this.network.online() && !isLocalRef) {
      return this.http.post<ApiResponse<Order>>(`${this.base}/${ref}/cancel`, {}).pipe(
        tap((res) => { if (res?.data) void this.repo.upsertOrder(res.data); }),
        catchError(() => from(this.enqueueCancel(ref)).pipe(map((data) => this.wrap(data)))),
      );
    }
    return from(this.enqueueCancel(ref)).pipe(map((data) => this.wrap(data)));
  }

  // ─── helpers ──────────────────────────────────────────────────
  /**
   * Stages a brand-new order in SQLite, hydrating each line with the
   * cached menu item so totals/labels are correct in the UI immediately.
   */
  private async enqueueCreate(payload: CreateOrderDto): Promise<Order> {
    const localUuid = uuidv4();
    const items = await this.hydrateItems(payload.items);
    const total = items.reduce((s, it) => s + it.subtotal, 0);

    const order: Order = {
      order_id: 0,
      order_number: `OFFLINE-${localUuid.slice(0, 6)}`,
      restaurant_table_id: payload.restaurant_table_id,
      subtotal: total,
      total_amount: total,
      payment_status: 'not_yet_paid',
      notes: payload.notes ?? null,
      items,
      items_count: items.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await this.repo.upsertOrder(order, { localUuid });
    await this.outbox.enqueue('order', 'create', payload, { localUuid });

    return { ...order, ...({ _local_uuid: localUuid } as any) };
  }

  private async enqueueAddItems(ref: OrderRef, payload: AddOrderItemsDto): Promise<Order> {
    const localUuid = await this.resolveLocalUuid(ref);
    const newItems = await this.hydrateItems(payload.items);
    await this.repo.addItemsToOrder(localUuid, newItems);

    await this.outbox.enqueue('order_items', 'create', { items: payload.items }, {
      dependsOn: localUuid,
    });

    const refreshed = await this.repo.getOrderByLocalUuid(localUuid);
    return { ...(refreshed as Order), ...({ _local_uuid: localUuid } as any) };
  }

  private async enqueueCancel(ref: OrderRef): Promise<Order> {
    const localUuid = await this.resolveLocalUuid(ref);
    await this.repo.markOrderCancelled(localUuid);
    await this.outbox.enqueue('order_cancel', 'update', {}, { dependsOn: localUuid });
    const refreshed = await this.repo.getOrderByLocalUuid(localUuid);
    return { ...(refreshed as Order), ...({ _local_uuid: localUuid } as any) };
  }

  /** Turn an id-or-uuid ref into the stable local_uuid we key everything on. */
  private async resolveLocalUuid(ref: OrderRef): Promise<string> {
    if (typeof ref === 'string') return ref;
    if (ref > 0) return this.repo.uuidForServerOrder(ref);
    // Negative id ⇒ optimistic placeholder. Look up by stashed local_uuid.
    const cached = await this.repo.getOrderByServerId(ref);
    return (cached as any)?._local_uuid ?? this.repo.uuidForServerOrder(ref);
  }

  /**
   * Joins each item with its cached menu row so we can compute totals
   * and display names without going back to the server.
   */
  private async hydrateItems(
    items: { menu_item_id: number; quantity: number; notes?: string | null }[],
  ): Promise<OrderItem[]> {
    const out: OrderItem[] = [];
    for (const raw of items) {
      const menu = await this.repo.getMenuItem(raw.menu_item_id);
      const price = menu?.price ?? 0;
      out.push({
        menu_item_id: raw.menu_item_id,
        item_name: menu?.name ?? `Item ${raw.menu_item_id}`,
        price,
        quantity: raw.quantity,
        subtotal: price * raw.quantity,
        notes: raw.notes ?? null,
      });
    }
    return out;
  }

  private fakePaginated(orders: Order[]): Paginated<Order> {
    return {
      data: orders,
      meta: { current_page: 1, last_page: 1, per_page: orders.length || 1, total: orders.length },
    };
  }

  private wrap<T>(data: T): ApiResponse<T> {
    return { success: true, message: 'cached', data };
  }
}
