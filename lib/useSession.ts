import { useCallback, useEffect, useState } from "react";
import { authApi, ApiError } from "./api";
import { clearToken, loadToken, saveToken } from "./auth";

export type SessionUser = {
  email: string;
  nni_masked?: string;
  whatsapp_masked?: string;
  is_admin?: boolean;
  credit_balance?: number;
  balance_mru?: number;
  credits_expire_at?: string | null;
  credits_blocked_reason?: string | null;
  can_use_paid_features?: boolean;
  referral_code?: string;
  free_hints_remaining?: number;
  free_hints_expires_at?: string | null;
};

type LoginPayload = { email: string; password: string };

type RegisterPayload = {
  email: string;
  password: string;
  nni: string;
  whatsapp: string;
  referral_code?: string;
};

type AuthResponse = {
  access_token: string;
  token_type: string;
  user: SessionUser;
};

type MeResponse = {
  authenticated: boolean;
  user?: SessionUser;
  auth_disabled?: boolean;
};

export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = await loadToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await authApi.get<MeResponse>("/api/auth/me");
      setUser(me.authenticated && me.user ? me.user : null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await clearToken();
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async ({ email, password }: LoginPayload) => {
    const r = await authApi.post<AuthResponse>("/api/auth/login", {
      email,
      password,
    });
    await saveToken(r.access_token);
    setUser(r.user);
  }, []);

  const register = useCallback(async (body: RegisterPayload) => {
    const r = await authApi.post<AuthResponse>("/api/auth/register", body);
    await saveToken(r.access_token);
    setUser(r.user);
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  return { user, loading, login, register, logout, refresh };
}
