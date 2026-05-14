import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, BehaviorSubject, finalize } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ApiResponse, AuthTokens, LoginResponse, Tenant, User,
} from '../models/api.models';
import { StorageService } from './storage.service';
import { ThemeService } from './theme.service';

export interface LoginPayload { email: string; password: string; device_name?: string, device_id: string; }
export interface PinLoginPayload { email: string; pin: string; device_name?: string }
export interface RegisterPayload {
  store_name: string;
  owner_name: string;
  email: string;
  password: string;
  password_confirmation: string;
  phone?: string;
  address?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(StorageService);
  private readonly theme = inject(ThemeService);

  private readonly base = environment.apiBaseUrl;
  private readonly keys = environment.storageKeys;

  // Reactive auth state via signals (Angular 20)
  private readonly _user = signal<User | null>(this.storage.get<User>(this.keys.user));
  private readonly _tenant = signal<Tenant | null>(this.storage.get<Tenant>(this.keys.tenant));

  // Reactive flag mirroring access-token presence. Updated on persist/clear so
  // computeds (and route guards) re-evaluate after login/logout.
  private readonly _hasToken = signal<boolean>(!!this.storage.getString(this.keys.accessToken));

  readonly user = this._user.asReadonly();
  readonly tenant = this._tenant.asReadonly();

  // Backend issues opaque Sanctum tokens (format: "{id}|{plaintext}"), not JWTs,
  // so we can't decode an `exp` claim client-side. Trust token presence — the
  // interceptor handles 401 by refreshing or logging out. _hasToken is reactive
  // on persistTokens()/clearLocalSession() so route guards re-evaluate.
  readonly isAuthenticated = computed(() => this._hasToken());
  readonly isVerified = computed(() => !!this._tenant()?.is_verified);

  /** True if the current tenant has the given module enabled. */
  hasModule(name: string): boolean {
    return (this._tenant()?.modules ?? []).includes(name);
  }

  /** True if the logged-in user is a platform super-admin (not tied to any tenant). */
  isSuperAdmin(): boolean {
    return this._user()?.role === 'super_admin';
  }

  /** Manager-and-above (super_admin, owner, manager). Cashier returns false. */
  isManagerOrAbove(): boolean {
    const r = this._user()?.role;
    return r === 'super_admin' || r === 'owner' || r === 'manager' || r === 'admin';
  }

  // Used by the HTTP interceptor to await an in-flight refresh.
  private readonly refreshing$ = new BehaviorSubject<boolean>(false);
  isRefreshing(): Observable<boolean> { return this.refreshing$.asObservable(); }

  constructor() {
    // Apply tenant theme from cache on cold start
    if (this._tenant()) this.theme.apply(this._tenant());
  }

  // ── Token getters ─────────────────────────────────────────
  getAccessToken(): string | null { return this.storage.getString(this.keys.accessToken); }
  getRefreshToken(): string | null { return this.storage.getString(this.keys.refreshToken); }

  // ── HTTP calls ────────────────────────────────────────────
  login(payload: LoginPayload): Observable<ApiResponse<LoginResponse>> {
    return this.http
      .post<ApiResponse<LoginResponse>>(`${this.base}/auth/login`, payload)
      .pipe(tap((res) => this.absorbAuthPayload(res)));
  }

  pinLogin(payload: PinLoginPayload): Observable<ApiResponse<LoginResponse>> {
    return this.http
      .post<ApiResponse<LoginResponse>>(`${this.base}/auth/pin-login`, payload)
      .pipe(tap((res) => this.absorbAuthPayload(res)));
  }

  // Some backends nest under `data`, others return flat — accept both.
  private absorbAuthPayload(res: any): void {
    const payload = res?.data ?? res;
    if (payload?.access_token) this.handleAuthSuccess(payload);
  }

  register(payload: RegisterPayload): Observable<ApiResponse<{ tenant: Tenant }>> {
    return this.http.post<ApiResponse<{ tenant: Tenant }>>(`${this.base}/auth/register`, payload);
  }

  forgotPassword(email: string): Observable<ApiResponse<null>> {
    return this.http.post<ApiResponse<null>>(`${this.base}/auth/forgot-password`, { email });
  }

  refresh(): Observable<ApiResponse<AuthTokens>> {
    const refresh_token = this.getRefreshToken();
    this.refreshing$.next(true);
    return this.http
      .post<ApiResponse<AuthTokens>>(`${this.base}/auth/refresh`, { refresh_token })
      .pipe(
        tap((res: any) => {
          const t = res?.data ?? res;
          if (t?.access_token) this.persistTokens(t);
        }),
        finalize(() => this.refreshing$.next(false)),
      );
  }

  me(): Observable<ApiResponse<User>> {
    return this.http
      .get<ApiResponse<User>>(`${this.base}/auth/me`)
      .pipe(tap((res: any) => {
        const u = res?.data ?? res;
        if (u?.id) this.persistUser(u);
      }));
  }

  logout(): Observable<ApiResponse<null>> {
    const refresh_token = this.getRefreshToken();
    return this.http
      .post<ApiResponse<null>>(`${this.base}/auth/logout`, { refresh_token })
      .pipe(finalize(() => this.clearLocalSession()));
  }

  // ── Persistence ───────────────────────────────────────────
  private handleAuthSuccess(payload: LoginResponse): void {
    this.persistTokens(payload);
    this.persistUser(payload.user);
  }

  private persistTokens(t: AuthTokens): void {
    this.storage.setString(this.keys.accessToken, t.access_token);
    this.storage.setString(this.keys.refreshToken, t.refresh_token);
    this._hasToken.set(true);
  }

  private persistUser(user: User): void {
    this._user.set(user);
    this.storage.set(this.keys.user, user);
    if (user.tenant) {
      this._tenant.set(user.tenant);
      this.storage.set(this.keys.tenant, user.tenant);
      this.theme.apply(user.tenant);
    }
  }

  setTenant(tenant: Tenant): void {
    this._tenant.set(tenant);
    this.storage.set(this.keys.tenant, tenant);
    this.theme.apply(tenant);
  }

  clearLocalSession(): void {
    this.storage.clearAuth([
      this.keys.accessToken,
      this.keys.refreshToken,
      this.keys.user,
      this.keys.tenant,
    ]);
    this._user.set(null);
    this._tenant.set(null);
    this._hasToken.set(false);
    this.theme.reset();
  }
}
