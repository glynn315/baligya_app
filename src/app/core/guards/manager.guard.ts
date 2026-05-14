import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Allow only manager+ (super_admin, owner, manager, admin); otherwise redirect home. */
export const managerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated() && auth.isManagerOrAbove()) return true;
  return router.createUrlTree(['/tabs/dashboard']);
};
