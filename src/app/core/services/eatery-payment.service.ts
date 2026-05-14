import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, from, map, Observable, tap } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { environment } from '../../../environments/environment';
import {
  ApiResponse, CreatePaymentDto, Paginated, Payment,
} from '../models/api.models';
import { EateryRepoService } from './offline/eatery-repo.service';
import { NetworkService } from './offline/network.service';
import { OutboxService } from './offline/outbox.service';

export interface ListPaymentsParams {
  date_from?: string;
  date_to?: string;
  payment_method?: string;
  order_id?: number;
  per_page?: number;
  page?: number;
}

/**
 * Extension of the API DTO that lets the offline layer accept a local
 * order reference. Pages should set `order_local_uuid` when the parent
 * order was created offline (and therefore has no `order_id` yet).
 */
export interface OfflineCreatePaymentDto extends CreatePaymentDto {
  order_local_uuid?: string;
}

@Injectable({ providedIn: 'root' })
export class EateryPaymentService {
  private readonly http = inject(HttpClient);
  private readonly repo = inject(EateryRepoService);
  private readonly network = inject(NetworkService);
  private readonly outbox = inject(OutboxService);
  private readonly base = `${environment.apiBaseUrl}/eatery/payments`;

  list(params: ListPaymentsParams = {}): Observable<ApiResponse<Paginated<Payment>> | Paginated<Payment>> {
    // List view is server-aggregated; offline returns empty rather than guessing.
    if (!this.network.online()) {
      return from(Promise.resolve(this.wrap({
        data: [], meta: { current_page: 1, last_page: 1, per_page: 0, total: 0 },
      } as Paginated<Payment>)));
    }
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => v != null && v !== '' && (p = p.set(k, String(v))));
    return this.http.get<ApiResponse<Paginated<Payment>> | Paginated<Payment>>(this.base, { params: p });
  }

  get(id: number): Observable<ApiResponse<Payment>> {
    if (!this.network.online()) {
      return from(this.repo.getPaymentByLocalUuid(`srv-pay-${id}`)).pipe(
        map((data) => this.wrap(data as Payment)),
      );
    }
    return this.http.get<ApiResponse<Payment>>(`${this.base}/${id}`);
  }

  pay(payload: OfflineCreatePaymentDto): Observable<ApiResponse<Payment>> {
    const offlineRef = this.needsLocalRef(payload);
    if (this.network.online() && !offlineRef) {
      // Strip the offline-only field before hitting the API.
      const { order_local_uuid, ...body } = payload;
      return this.http.post<ApiResponse<Payment>>(this.base, body).pipe(
        tap((res) => {
          if (res?.data) {
            void this.repo.upsertPayment(res.data);
            if (res.data.order_id) {
              void this.repo.getOrderByServerId(res.data.order_id).then((o) => {
                if (o) void this.repo.markOrderPaid((o as any)._local_uuid);
              });
            }
          }
        }),
        catchError(() => from(this.enqueuePay(payload)).pipe(map((data) => this.wrap(data)))),
      );
    }
    return from(this.enqueuePay(payload)).pipe(map((data) => this.wrap(data)));
  }

  // ─── helpers ──────────────────────────────────────────────────
  /**
   * A payment is "local-ref" when its parent order hasn't been seen by
   * the server yet — caller passed only order_local_uuid (no order_id)
   * OR passed an order_id that's still negative/0 (offline placeholder).
   */
  private needsLocalRef(payload: OfflineCreatePaymentDto): boolean {
    if (payload.order_local_uuid) return true;
    if (payload.order_id == null || payload.order_id <= 0) return !!payload.order_local_uuid || payload.order_id == null;
    return false;
  }

  private async enqueuePay(payload: OfflineCreatePaymentDto): Promise<Payment> {
    const localUuid = uuidv4();
    const orderLocalUuid = payload.order_local_uuid
      ?? (payload.order_id && payload.order_id > 0
        ? this.repo.uuidForServerOrder(payload.order_id)
        : undefined);

    const order = orderLocalUuid ? await this.repo.getOrderByLocalUuid(orderLocalUuid) : null;
    const total = order?.total_amount ?? 0;
    const change = (payload.cash_received ?? 0) - total;

    const payment: Payment = {
      payment_id: 0,
      order_id: payload.order_id && payload.order_id > 0 ? payload.order_id : 0,
      total_amount: total,
      cash_received: payload.cash_received ?? 0,
      change_amount: change > 0 ? change : 0,
      payment_method: payload.payment_method ?? 'cash',
      reference: payload.reference ?? null,
      notes: payload.notes ?? null,
      payment_date: new Date().toISOString(),
      receipt: {
        // Local placeholder receipt — the server replaces it on sync.
        receipt_no: `OFFLINE-${localUuid.slice(0, 6)}`,
        print_lines: this.buildOfflineReceipt(total, payload.cash_received ?? 0, change),
      },
    };

    await this.repo.upsertPayment(payment, { localUuid, orderLocalUuid });
    if (orderLocalUuid) await this.repo.markOrderPaid(orderLocalUuid);

    // Build the API payload — server expects order_id, which may resolve later.
    const { order_local_uuid, ...rest } = payload;
    await this.outbox.enqueue('payment', 'create', rest, {
      localUuid,
      dependsOn: orderLocalUuid,
    });
    return payment;
  }

  private buildOfflineReceipt(total: number, cash: number, change: number): string[] {
    return [
      '*** OFFLINE RECEIPT ***',
      `Total:    ₱ ${total.toFixed(2)}`,
      `Cash:     ₱ ${cash.toFixed(2)}`,
      `Change:   ₱ ${(change > 0 ? change : 0).toFixed(2)}`,
      '',
      'Will sync when online.',
    ];
  }

  private wrap<T>(data: T): ApiResponse<T> {
    return { success: true, message: 'cached', data };
  }
}
