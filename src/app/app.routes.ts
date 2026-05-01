import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // ─── Public auth ─────────────────────────────────────────
  {
    path: 'auth',
    canActivate: [guestGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'login' },
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/login/login.page').then((m) => m.LoginPage),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./features/auth/register/register.page').then((m) => m.RegisterPage),
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./features/auth/forgot-password/forgot-password.page').then((m) => m.ForgotPasswordPage),
      },
    ],
  },
  {
    path: 'auth/verify-pending',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/verify-pending/verify-pending.page').then((m) => m.VerifyPendingPage),
  },

  // ─── Tabs shell ──────────────────────────────────────────
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/tabs/tabs.page').then((m) => m.TabsPage),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'pos',
        loadComponent: () =>
          import('./features/pos/pos.page').then((m) => m.PosPage),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/products/products.page').then((m) => m.ProductsPage),
      },
      {
        path: 'sales',
        loadComponent: () =>
          import('./features/sales/sales.page').then((m) => m.SalesPage),
      },
      {
        path: 'more',
        loadComponent: () =>
          import('./features/more/more.page').then((m) => m.MorePage),
      },
    ],
  },

  // ─── Standalone pages ────────────────────────────────────
  {
    path: 'expenses',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/expenses/expenses.page').then((m) => m.ExpensesPage),
  },
  {
    path: 'inventory',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/inventory/inventory.page').then((m) => m.InventoryPage),
  },
  {
    path: 'employees',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/employees/employees.page').then((m) => m.EmployeesPage),
  },
  {
    path: 'categories',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/categories/categories.page').then((m) => m.CategoriesPage),
  },
  {
    path: 'settings/security',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/settings/security/security.page').then((m) => m.SecurityPage),
  },
  {
    path: 'settings/subscription',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/settings/subscription/subscription.page').then((m) => m.SubscriptionPage),
  },
  {
    path: 'settings/store',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/settings/store/store.page').then((m) => m.StorePage),
  },

  // ─── Defaults ───────────────────────────────────────────
  { path: '', pathMatch: 'full', redirectTo: 'tabs/dashboard' },
  { path: '**', redirectTo: 'tabs/dashboard' },
];
