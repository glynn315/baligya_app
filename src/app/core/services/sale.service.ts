import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { from, map, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ApiResponse, CommitSaleDto, CreateSaleDto, Paginated, Receipt, RefundSaleDto, Sale, SaleRefund,
} from '../models/api.models';
import { NetworkService } from './offline/network.service';
import { OutboxService } from './offline/outbox.service';
import { PosRepoService } from './offline/pos-repo.service';

@Injectable({ providedIn: 'root' })
export class SaleService {
  private readonly http = inject(HttpClient);
  private readonly network = inject(NetworkService);
  private readonly outbox = inject(OutboxService);
  private readonly repo = inject(PosRepoService);
  private readonly base = environment.apiBaseUrl;

  list(params: {
    from?: string; to?: string; status?: string;
    per_page?: number; page?: number;
  } = {}) {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => v != null && (p = p.set(k, String(v))));
    return this.http.get<ApiResponse<Paginated<Sale>> | Paginated<Sale>>(
      `${this.base}/sales`, { params: p },
    );
  }

  get(id: number): Observable<ApiResponse<Sale>> {
    return this.http.get<ApiResponse<Sale>>(`${this.base}/sales/${id}`);
  }

  /**
   * Create a sale. If offline, the sale is queued in the outbox and the
   * UI gets an optimistic temp record. If the sale is a draft (as_draft=true)
   * it is also persisted locally as a sale_drafts row for resumption.
   */
  create(payload: CreateSaleDto): Observable<ApiResponse<Sale>> {
    if (this.network.online()) {
      return this.http.post<ApiResponse<Sale>>(`${this.base}/sales`, payload);
    }
    return from(this.enqueueCreate(payload)).pipe(
      map((data) => ({ success: true, message: 'queued', data })),
    );
  }

  /** Suspend an existing draft sale (no stock change). */
  suspend(id: number, note?: string): Observable<ApiResponse<Sale>> {
    return this.http.post<ApiResponse<Sale>>(`${this.base}/sales/${id}/suspend`, { note });
  }

  /** Resume a draft for editing — just fetches it. */
  resume(id: number): Observable<ApiResponse<Sale>> {
    return this.http.post<ApiResponse<Sale>>(`${this.base}/sales/${id}/resume`, {});
  }

  /** Commit a draft sale (validates stock, deducts inventory, completes). */
  commit(id: number, payload: CommitSaleDto): Observable<ApiResponse<Sale>> {
    if (this.network.online()) {
      return this.http.post<ApiResponse<Sale>>(`${this.base}/sales/${id}/commit`, payload);
    }
    return from(this.outbox.enqueue('sale_commit', 'create', { _id: id, ...payload })).pipe(
      map(() => ({ success: true, message: 'queued', data: undefined })),
    );
  }

  refund(id: number, payload: RefundSaleDto): Observable<ApiResponse<SaleRefund>> {
    if (this.network.online()) {
      return this.http.post<ApiResponse<SaleRefund>>(`${this.base}/sales/${id}/refund`, payload);
    }
    return from(this.outbox.enqueue('sale_refund', 'create', { _id: id, ...payload })).pipe(
      map(() => ({ success: true, message: 'queued', data: undefined })),
    );
  }

  receipt(id: number): Observable<ApiResponse<Receipt>> {
    return this.http.get<ApiResponse<Receipt>>(`${this.base}/sales/${id}/receipt`);
  }

  void(id: number, reason?: string): Observable<ApiResponse<Sale>> {
    if (this.network.online()) {
      return this.http.post<ApiResponse<Sale>>(`${this.base}/sales/${id}/void`, { reason });
    }
    return from(this.outbox.enqueue('sale_void', 'create', { _id: id, reason })).pipe(
      map(() => ({ success: true, message: 'queued', data: undefined })),
    );
  }

  // ─── Local drafts ─────────────────────────────────────────────
  saveLocalDraft(cart: any): Promise<string> {
    const localUuid = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return this.repo.saveSaleDraft(localUuid, JSON.stringify(cart)).then(() => localUuid);
  }

  async listLocalDrafts(): Promise<{ local_uuid: string; cart: any; updated_at: string }[]> {
    const rows = await this.repo.listSaleDrafts();
    return rows.map((r) => ({
      local_uuid: r.local_uuid,
      cart: this.safeParse(r.cart_json),
      updated_at: r.updated_at,
    }));
  }

  deleteLocalDraft(localUuid: string): Promise<void> {
    return this.repo.deleteSaleDraft(localUuid);
  }

  // ─── Offline helpers ──────────────────────────────────────────
  private async enqueueCreate(payload: CreateSaleDto): Promise<Sale> {
    const localUuid = `sale-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (payload.as_draft) {
      await this.repo.saveSaleDraft(localUuid, JSON.stringify(payload));
    }
    await this.outbox.enqueue('sale_create', 'create', { ...payload, _local_uuid: localUuid });

    // Optimistic placeholder. Server-issued fields (id, transaction_number)
    // will be filled in on sync.
    const subtotal = (payload.items ?? []).reduce(
      (acc, it) => acc + (it.unit_price ?? 0) * (it.quantity ?? 0) - (it.discount ?? 0),
      0,
    );
    return {
      id: -Date.now(),
      transaction_number: `OFFLINE-${localUuid.slice(-6)}`,
      subtotal,
      discount_amount: payload.discount_amount ?? 0,
      tax_amount: payload.tax_amount ?? 0,
      total: subtotal - (payload.discount_amount ?? 0) + (payload.tax_amount ?? 0),
      amount_paid: payload.amount_paid ?? 0,
      change_amount: Math.max(0, (payload.amount_paid ?? 0) - subtotal),
      payment_method: payload.payment_method ?? 'cash',
      status: payload.as_draft ? 'draft' : 'completed',
      created_at: new Date().toISOString(),
      payments: payload.payments,
    } as Sale;
  }

  private safeParse(s: string): any {
    try { return JSON.parse(s); } catch { return null; }
  }
}
