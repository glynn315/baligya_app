import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse, Employee } from '../models/api.models';

export interface CreateEmployeeDto {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  role: 'manager' | 'cashier' | string;
  pin?: string;
  is_active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  list(): Observable<ApiResponse<Employee[]>> {
    return this.http.get<ApiResponse<Employee[]>>(`${this.base}/employees`);
  }
  create(payload: CreateEmployeeDto): Observable<ApiResponse<Employee>> {
    return this.http.post<ApiResponse<Employee>>(`${this.base}/employees`, payload);
  }
  update(id: number, payload: Partial<CreateEmployeeDto>): Observable<ApiResponse<Employee>> {
    return this.http.put<ApiResponse<Employee>>(`${this.base}/employees/${id}`, payload);
  }
  destroy(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/employees/${id}`);
  }
}
