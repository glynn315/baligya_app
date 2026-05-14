import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ApiResponse, EateryDailyReport, EateryMonthlyReport, EaterySummary,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class EateryReportService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/eatery`;

  summary(): Observable<ApiResponse<EaterySummary>> {
    return this.http.get<ApiResponse<EaterySummary>>(`${this.base}/dashboard/summary`);
  }

  daily(date?: string): Observable<ApiResponse<EateryDailyReport>> {
    let p = new HttpParams();
    if (date) p = p.set('date', date);
    return this.http.get<ApiResponse<EateryDailyReport>>(`${this.base}/reports/daily`, { params: p });
  }

  monthly(year?: number, month?: number): Observable<ApiResponse<EateryMonthlyReport>> {
    let p = new HttpParams();
    if (year) p = p.set('year', String(year));
    if (month) p = p.set('month', String(month));
    return this.http.get<ApiResponse<EateryMonthlyReport>>(`${this.base}/reports/monthly`, { params: p });
  }
}
