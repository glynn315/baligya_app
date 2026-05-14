import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse, Paginated, Supplier } from '../models/api.models';

export interface ListSuppliersParams {
  search?: string;
  is_active?: boolean;
  per_page?: number;
  page?: number;
}

export interface CreateSupplierDto {
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface UpdateSupplierDto extends Partial<CreateSupplierDto> {
  is_active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/suppliers`;

  list(params: ListSuppliersParams = {}): Observable<ApiResponse<Paginated<Supplier>> | Paginated<Supplier>> {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => v != null && (p = p.set(k, String(v))));
    return this.http.get<ApiResponse<Paginated<Supplier>> | Paginated<Supplier>>(this.base, { params: p });
  }

  active(): Observable<ApiResponse<Supplier[]>> {
    return this.http.get<ApiResponse<Supplier[]>>(`${this.base}/active`);
  }

  get(id: number): Observable<ApiResponse<Supplier>> {
    return this.http.get<ApiResponse<Supplier>>(`${this.base}/${id}`);
  }

  create(payload: CreateSupplierDto): Observable<ApiResponse<Supplier>> {
    return this.http.post<ApiResponse<Supplier>>(this.base, payload);
  }

  update(id: number, payload: UpdateSupplierDto): Observable<ApiResponse<Supplier>> {
    return this.http.put<ApiResponse<Supplier>>(`${this.base}/${id}`, payload);
  }

  destroy(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/${id}`);
  }
}
