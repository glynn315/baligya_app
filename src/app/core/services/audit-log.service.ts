import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse, AuditLog, Paginated } from '../models/api.models';

export interface ListAuditLogsParams {
  entity_type?: string;
  entity_id?: string | number;
  action?: string;
  user_id?: number;
  date_from?: string;
  date_to?: string;
  per_page?: number;
  page?: number;
}

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/audit-logs`;

  list(params: ListAuditLogsParams = {}): Observable<ApiResponse<Paginated<AuditLog>> | Paginated<AuditLog>> {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => v != null && (p = p.set(k, String(v))));
    return this.http.get<ApiResponse<Paginated<AuditLog>> | Paginated<AuditLog>>(this.base, { params: p });
  }
}
