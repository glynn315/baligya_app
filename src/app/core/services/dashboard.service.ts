import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse, DashboardSummary, Product } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  summary(): Observable<ApiResponse<DashboardSummary>> {
    return this.http.get<ApiResponse<DashboardSummary>>(`${this.base}/dashboard/summary`);
  }

  salesReport(from?: string, to?: string) {
    let p = new HttpParams();
    if (from) p = p.set('from', from);
    if (to) p = p.set('to', to);
    return this.http.get<ApiResponse<unknown>>(`${this.base}/dashboard/sales-report`, { params: p });
  }

  expenseReport(from?: string, to?: string) {
    let p = new HttpParams();
    if (from) p = p.set('from', from);
    if (to) p = p.set('to', to);
    return this.http.get<ApiResponse<unknown>>(`${this.base}/dashboard/expense-report`, { params: p });
  }

  topProducts(limit = 5): Observable<ApiResponse<Product[]>> {
    const p = new HttpParams().set('limit', String(limit));
    return this.http.get<ApiResponse<Product[]>>(`${this.base}/dashboard/top-products`, { params: p });
  }
}
