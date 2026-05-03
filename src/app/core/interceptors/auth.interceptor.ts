import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * Adds the Sanctum bearer token and attempts a one-shot refresh on 401.
 * Refresh failures propagate as-is — the user stays on the current page
 * and can choose when to sign out.
 *
 * Multi-tenancy: the backend resolves tenant from the authenticated user,
 * so we only need to attach the Sanctum token here. No tenant header needed.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

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

      // 401 on a protected request → try refresh once, then replay.
      // If refresh itself fails, surface the error but do NOT force-logout.
      return auth.refresh().pipe(
        switchMap((res) => {
          const newToken = res.data?.access_token;
          if (!newToken) throw err;
          const replay = req.clone({
            setHeaders: { Authorization: `Bearer ${newToken}` },
          });
          return next(replay);
        }),
        catchError((refreshErr) => throwError(() => refreshErr)),
      );
    }),
  );
};
