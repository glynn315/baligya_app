import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }

  const isPublicAuth =
    /\/auth\/(login|register|refresh|forgot-password|reset-password|pin-login|verify)/.test(req.url);

  const token = auth.getAccessToken();

  const authReq = token && !isPublicAuth
    ? req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })
    : req.clone({ setHeaders: { Accept: 'application/json' } });

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {

      if (err.status !== 401 || isPublicAuth || !auth.getRefreshToken()) {
        return throwError(() => err);
      }

      return auth.refresh().pipe(
        switchMap((res) => {
          // Backend response may be { data: { access_token } } or flat — accept both.
          const newToken = (res as any)?.data?.access_token ?? (res as any)?.access_token;

          if (!newToken) {
            // Refresh "succeeded" but no token — treat as session dead.
            auth.clearLocalSession();
            router.navigateByUrl('/auth/login', { replaceUrl: true });
            return throwError(() => err);
          }

          return next(
            req.clone({
              setHeaders: { Authorization: `Bearer ${newToken}` },
            })
          );
        }),

        catchError((refreshErr: HttpErrorResponse) => {
          // 🔴 Any refresh failure = session is dead. This is also how
          // single-device login enforcement kicks the old device: when a new
          // login on device A wipes tokens, device B's next request 401s, the
          // refresh attempt also fails (its refresh_token row was deleted),
          // and we land here → local session cleared, redirected to login.
          auth.clearLocalSession();
          router.navigateByUrl('/auth/login', { replaceUrl: true });
          return throwError(() => refreshErr);
        })
      );
    })
  );
};