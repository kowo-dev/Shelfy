import { HttpClient } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, type Observable } from 'rxjs';
import { environment } from '@env';
import type {
  AuthResponse,
  ConfirmEmailChangePayload,
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
  RequestEmailChangePayload,
  ResendVerificationPayload,
  ResetPasswordPayload,
  UpdateProfilePayload,
  UpdateProfileBannerPayload,
  User,
  UsernameAvailabilityResponse,
  VerifyEmailPayload,
} from './auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly baseUrl = environment.baseUrl;

  private readonly _accessToken = signal<string | null>(null);
  private readonly _currentUser = signal<User | null>(null);

  readonly accessToken = this._accessToken.asReadonly();
  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._accessToken() !== null);

  private wasAuthenticated = false;

  constructor() {
    effect(() => {
      const authenticated = this.isAuthenticated();
      if (!authenticated && this.wasAuthenticated) {
        void this.router.navigateByUrl('/auth/login');
      }
      this.wasAuthenticated = authenticated;
    });
  }

  async init(): Promise<void> {
    await this.tryRestoreSession();
  }

  private async tryRestoreSession(): Promise<void> {
    if (this._accessToken()) {
      await this.loadCurrentUser();
      return;
    }

    try {
      const response = await firstValueFrom(this.refreshToken());
      this.setAccessToken(response.accessToken);
      await this.loadCurrentUser();
    } catch {
      this.clearSession();
    }
  }

  private async loadCurrentUser(): Promise<void> {
    const user = await firstValueFrom(this.retrieveUser());
    this._currentUser.set(user);
  }

  async register(payload: RegisterPayload): Promise<User> {
    return firstValueFrom(this.http.post<User>(`${this.baseUrl}/auth/register`, payload));
  }

  async verifyEmail(payload: VerifyEmailPayload): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${this.baseUrl}/auth/verify-email`, payload));
  }

  async resendVerification(payload: ResendVerificationPayload): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${this.baseUrl}/auth/resend-verification`, payload));
  }

  async login(payload: LoginPayload): Promise<User> {
    const response = await firstValueFrom(
      this.http.post<AuthResponse>(`${this.baseUrl}/auth/login`, payload),
    );

    this.setAccessToken(response.accessToken);

    try {
      return await this.refreshCurrentUser();
    } catch (error) {
      this.clearSession();
      throw error;
    }
  }

  async forgotPassword(payload: ForgotPasswordPayload): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${this.baseUrl}/auth/forgot-password`, payload));
  }

  async resetPassword(payload: ResetPasswordPayload): Promise<void> {
    await firstValueFrom(this.http.post<void>(`${this.baseUrl}/auth/reset-password`, payload));
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post<void>(`${this.baseUrl}/auth/logout`, {}));
    } finally {
      this.clearSession();
    }
  }

  retrieveUser(): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/users/me`);
  }

  async refreshCurrentUser(): Promise<User> {
    const user = await firstValueFrom(this.retrieveUser());
    this._currentUser.set(user);
    return user;
  }

  async updateProfile(payload: UpdateProfilePayload): Promise<User> {
    const user = await firstValueFrom(this.http.patch<User>(`${this.baseUrl}/users/me`, payload));
    this._currentUser.set(user);
    return user;
  }

  async updateProfileBanner(payload: UpdateProfileBannerPayload): Promise<User> {
    const user = await firstValueFrom(
      this.http.patch<User>(`${this.baseUrl}/users/me/profile-banner`, payload),
    );
    this._currentUser.set(user);
    return user;
  }

  async clearProfileBanner(): Promise<User> {
    const user = await firstValueFrom(
      this.http.delete<User>(`${this.baseUrl}/users/me/profile-banner`),
    );
    this._currentUser.set(user);
    return user;
  }

  async uploadAvatar(file: File): Promise<User> {
    const formData = new FormData();
    formData.append('file', file);
    const user = await firstValueFrom(
      this.http.post<User>(`${this.baseUrl}/users/me/avatar`, formData),
    );
    this._currentUser.set(user);
    return user;
  }

  async removeAvatar(): Promise<User> {
    const user = await firstValueFrom(this.http.delete<User>(`${this.baseUrl}/users/me/avatar`));
    this._currentUser.set(user);
    return user;
  }

  async requestEmailChange(payload: RequestEmailChangePayload): Promise<void> {
    await firstValueFrom(
      this.http.post<void>(`${this.baseUrl}/users/me/email/change-request`, payload),
    );
    await this.refreshCurrentUser();
  }

  async confirmEmailChange(payload: ConfirmEmailChangePayload): Promise<void> {
    await firstValueFrom(
      this.http.post<User>(`${this.baseUrl}/auth/confirm-email-change`, payload),
    );
    if (this.isAuthenticated()) {
      await this.refreshCurrentUser();
    }
  }

  async deleteAccount(password: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/users/me`, { body: { password } }),
    );
    await this.logout();
  }

  async exportData(): Promise<void> {
    const blob = await firstValueFrom(
      this.http.get(`${this.baseUrl}/users/me/export`, { responseType: 'blob' }),
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'shelfy-data-export.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  checkUsernameAvailability(value: string): Observable<UsernameAvailabilityResponse> {
    return this.http.get<UsernameAvailabilityResponse>(
      `${this.baseUrl}/users/me/username-availability`,
      { params: { value } },
    );
  }

  refreshToken(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/refresh`, {});
  }

  setAccessToken(accessToken: string): void {
    this._accessToken.set(accessToken);
  }

  clearSession(): void {
    this._accessToken.set(null);
    this._currentUser.set(null);
  }
}
