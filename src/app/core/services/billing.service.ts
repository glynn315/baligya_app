import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse, Invoice, Paginated, Tenant } from '../models/api.models';
import { AuthService } from './auth.service';

/**
 * Self-service billing — backend issues invoices for paid plan changes,
 * the user settles them via dummy GCash flow, and a successful payment
 * flips the tenant's subscription on the server.
 */
@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = environment.apiBaseUrl;

  list(params: { per_page?: number; page?: number } = {}): Observable<ApiResponse<Paginated<Invoice>> | Paginated<Invoice>> {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => v != null && (p = p.set(k, String(v))));
    return this.http.get<ApiResponse<Paginated<Invoice>> | Paginated<Invoice>>(
      `${this.base}/invoices`, { params: p },
    );
  }

  show(id: number): Observable<ApiResponse<Invoice>> {
    return this.http.get<ApiResponse<Invoice>>(`${this.base}/invoices/${id}`);
  }

  /**
   * Submit a GCash reference number to mark the invoice paid. In dummy mode
   * this also activates the linked plan, so we refresh the tenant cache.
   */
  pay(id: number, reference_number: string): Observable<ApiResponse<Invoice>> {
    return this.http
      .post<ApiResponse<Invoice>>(`${this.base}/invoices/${id}/pay`, { reference_number })
      .pipe(tap(() => this.refreshTenant()));
  }

  cancel(id: number): Observable<ApiResponse<Invoice>> {
    return this.http.post<ApiResponse<Invoice>>(`${this.base}/invoices/${id}/cancel`, {});
  }

  private refreshTenant(): void {
    this.http
      .get<ApiResponse<Tenant>>(`${this.base}/tenant/subscription`)
      .subscribe({ next: (res) => res.data && this.auth.setTenant(res.data), error: () => {} });
  }
}
