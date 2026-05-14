import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse, Paginated, Tenant, TenantModule } from '../models/api.models';

export interface ListTenantsParams {
  status?: string;
  search?: string;
  per_page?: number;
  page?: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/admin`;

  /**
   * Backend returns ResourceCollection — shape is `{ data: Tenant[], meta, links, success, message }`.
   */
  listTenants(params: ListTenantsParams = {}): Observable<Paginated<Tenant> & { success?: boolean; message?: string }> {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => v != null && v !== '' && (p = p.set(k, String(v))));
    return this.http.get<Paginated<Tenant> & { success?: boolean; message?: string }>(
      `${this.base}/tenants`, { params: p },
    );
  }

  showTenant(id: number): Observable<ApiResponse<Tenant>> {
    return this.http.get<ApiResponse<Tenant>>(`${this.base}/tenants/${id}`);
  }

  verifyTenant(id: number): Observable<ApiResponse<Tenant>> {
    return this.http.post<ApiResponse<Tenant>>(`${this.base}/tenants/${id}/verify`, {});
  }

  suspendTenant(id: number): Observable<ApiResponse<Tenant>> {
    return this.http.post<ApiResponse<Tenant>>(`${this.base}/tenants/${id}/suspend`, {});
  }

  updateModules(id: number, modules: TenantModule[]): Observable<ApiResponse<Tenant>> {
    return this.http.put<ApiResponse<Tenant>>(`${this.base}/tenants/${id}/modules`, { modules });
  }
}
