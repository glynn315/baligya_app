import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * Adds the Sanctum bearer token, falls back to refresh on 401, and
 * routes the user back to login when the refresh fails.
 *
 * Multi-tenancy: the backend resolves tenant from the authenticated user,
 * so we only need to attach the Sanctum token here. No tenant header needed.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Only touch our own API
  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }

  // Skip auth header for the refresh + public auth endpoints
  const isPublicAuth = /\/auth\/(login|register|refresh|forgot-password|reset-password|pin-login|verify)/.test(req.url);
  const token = auth.getAccessToken();

  const authed = token && !isPublicAuth
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      })
    : req.clone({ setHeaders: { Accept: 'application/json' } });

  return next(authed).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || isPublicAuth || !auth.getRefreshToken()) {
        return throwError(() => err);
      }

      // 401 on a protected request → try refresh once, then replay
      return auth.refresh().pipe(
        switchMap((res) => {
          const newToken = res.data?.access_token;
          if (!newToken) throw err;
          const replay = req.clone({
            setHeaders: { Authorization: `Bearer ${newToken}` },
          });
          return next(replay);
        }),
        catchError((refreshErr) => {
          auth.clearLocalSession();
          router.navigate(['/auth/login'], { replaceUrl: true });
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
