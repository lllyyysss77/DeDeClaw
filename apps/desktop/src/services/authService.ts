import type {
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
  VerifyTokenResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  UserPreferences,
  UserPreferencesResponse,
} from '../shared/types/auth';
import { API_BASE_URL } from './apiBase';

export const authService = {
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    return response.json();
  },

  async fetchPreferences(token: string): Promise<UserPreferencesResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/preferences`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.json() as Promise<UserPreferencesResponse>;
  },

  async savePreferences(data: UserPreferences, token: string): Promise<UserPreferencesResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    return response.json() as Promise<UserPreferencesResponse>;
  },

  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    return response.json();
  },

  async verifyToken(token: string): Promise<VerifyTokenResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    return response.json();
  },

  async updateProfile(data: UpdateProfileRequest, token: string): Promise<UpdateProfileResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    return response.json();
  },

  saveToken(token: string): void {
    localStorage.setItem('auth_token', token);
  },

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  },

  removeToken(): void {
    localStorage.removeItem('auth_token');
  },

  saveUserInfo(userId: string, username: string): void {
    localStorage.setItem('auth_user_id', userId);
    localStorage.setItem('auth_username', username);
  },

  getUserId(): string | null {
    return localStorage.getItem('auth_user_id');
  },

  getUsername(): string | null {
    return localStorage.getItem('auth_username');
  },

  clearUserInfo(): void {
    localStorage.removeItem('auth_user_id');
    localStorage.removeItem('auth_username');
  },
};
