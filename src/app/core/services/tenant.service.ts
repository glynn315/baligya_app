import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse, Tenant } from '../models/api.models';
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
