import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse, Invoice, SubscriptionPlan, Tenant } from '../models/api.models';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = environment.apiBaseUrl;

  show(): Observable<ApiResponse<Tenant>> {
    return this.http
      .get<ApiResponse<Tenant>>(`${this.base}/tenant`)
      .pipe(tap((res) => res.data && this.auth.setTenant(res.data)));
  }

  update(payload: Partial<Tenant>): Observable<ApiResponse<Tenant>> {
    return this.http
      .put<ApiResponse<Tenant>>(`${this.base}/tenant`, payload)
      .pipe(tap((res) => res.data && this.auth.setTenant(res.data)));
  }
}

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = environment.apiBaseUrl;

  /** All active plans available for self-service. */
  plans(): Observable<ApiResponse<SubscriptionPlan[]>> {
    return this.http.get<ApiResponse<SubscriptionPlan[]>>(`${this.base}/plans`);
  }

  /** Current tenant + plan. Mirrors the result back into AuthService. */
  current(): Observable<ApiResponse<Tenant>> {
    return this.http
      .get<ApiResponse<Tenant>>(`${this.base}/tenant/subscription`)
      .pipe(tap((res) => res.data && this.auth.setTenant(res.data)));
  }

  /**
   * Switch to a plan.
   *
   * Free plans return the refreshed Tenant (200) and we update the auth cache.
   * Paid plans return a pending Invoice (202) — caller routes the user to the
   * billing screen to complete payment, and we leave the tenant cache alone.
   */
  change(planId: number): Observable<ApiResponse<Tenant | Invoice>> {
    return this.http
      .post<ApiResponse<Tenant | Invoice>>(`${this.base}/tenant/subscription`, {
        subscription_plan_id: planId,
      })
      .pipe(tap((res) => {
        const d = res.data as any;
        if (d && !('invoice_number' in d)) this.auth.setTenant(d as Tenant);
      }));
  }
}
