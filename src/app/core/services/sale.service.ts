import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse, CreateSaleDto, Paginated, Sale } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class SaleService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  list(params: { from?: string; to?: string; status?: string; per_page?: number; page?: number } = {}) {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => v != null && (p = p.set(k, String(v))));
    return this.http.get<ApiResponse<Paginated<Sale>> | Paginated<Sale>>(
      `${this.base}/sales`, { params: p },
    );
  }

  get(id: number): Observable<ApiResponse<Sale>> {
    return this.http.get<ApiResponse<Sale>>(`${this.base}/sales/${id}`);
  }

  create(payload: CreateSaleDto): Observable<ApiResponse<Sale>> {
    return this.http.post<ApiResponse<Sale>>(`${this.base}/sales`, payload);
  }

  void(id: number, reason?: string): Observable<ApiResponse<Sale>> {
    return this.http.post<ApiResponse<Sale>>(`${this.base}/sales/${id}/void`, { reason });
  }
}
