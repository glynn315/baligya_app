import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse, Module } from '../models/api.models';

export interface CreateModuleDto {
  name: string;
  display_name: string;
  description?: string | null;
  icon?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

export interface UpdateModuleDto {
  display_name?: string;
  description?: string | null;
  icon?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

@Injectable({ providedIn: 'root' })
export class AdminModuleService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/admin/modules`;

  list(activeOnly = false): Observable<ApiResponse<Module[]>> {
    let p = new HttpParams();
    if (activeOnly) p = p.set('active_only', 'true');
    return this.http.get<ApiResponse<Module[]>>(this.base, { params: p });
  }

  get(id: number): Observable<ApiResponse<Module>> {
    return this.http.get<ApiResponse<Module>>(`${this.base}/${id}`);
  }

  create(payload: CreateModuleDto): Observable<ApiResponse<Module>> {
    return this.http.post<ApiResponse<Module>>(this.base, payload);
  }

  update(id: number, payload: UpdateModuleDto): Observable<ApiResponse<Module>> {
    return this.http.put<ApiResponse<Module>>(`${this.base}/${id}`, payload);
  }

  delete(id: number, detachTenants = false): Observable<ApiResponse<null>> {
    let p = new HttpParams();
    if (detachTenants) p = p.set('detach_tenants', 'true');
    return this.http.delete<ApiResponse<null>>(`${this.base}/${id}`, { params: p });
  }
}
