import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse, Expense, InventoryLog, Paginated } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  list(params: { from?: string; to?: string; per_page?: number; page?: number } = {}) {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => v != null && (p = p.set(k, String(v))));
    return this.http.get<ApiResponse<Paginated<Expense>> | Paginated<Expense>>(
      `${this.base}/expenses`, { params: p },
    );
  }

  create(payload: Partial<Expense>): Observable<ApiResponse<Expense>> {
    return this.http.post<ApiResponse<Expense>>(`${this.base}/expenses`, payload);
  }

  update(id: number, payload: Partial<Expense>): Observable<ApiResponse<Expense>> {
    return this.http.put<ApiResponse<Expense>>(`${this.base}/expenses/${id}`, payload);
  }

  destroy(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/expenses/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  logs(params: { product_id?: number; per_page?: number; page?: number } = {}) {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => v != null && (p = p.set(k, String(v))));
    return this.http.get<ApiResponse<Paginated<InventoryLog>> | Paginated<InventoryLog>>(
      `${this.base}/inventory`, { params: p },
    );
  }

  adjust(payload: {
    product_id: number;
    quantity: number;
    type?: 'purchase' | 'adjustment' | 'return';
    notes?: string;
  }): Observable<ApiResponse<InventoryLog>> {
    return this.http.post<ApiResponse<InventoryLog>>(
      `${this.base}/inventory/adjust`,
      { type: 'purchase', ...payload },
    );
  }
}
