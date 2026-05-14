import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Allow only super-admin users; otherwise redirect to /tabs/dashboard. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated() && auth.isSuperAdmin()) return true;
  return router.createUrlTree(['/tabs/dashboard']);
};
