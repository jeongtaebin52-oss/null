"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AccountData = {
  anonUserId?: string;
  email?: string | null;
  isLoggedIn?: boolean;
  plan?: { id: string; name: string };
  features?: Record<string, boolean>;
  error?: string;
};

type FormState = {
  email: string;
  password: string;
  passwordConfirm: string;
};

const STORAGE_KEY = "anon_user_id";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export default function AccountView() {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [login, setLogin] = useState<FormState>({ email: "", password: "", passwordConfirm: "" });
  const [signup, setSignup] = useState<FormState>({ email: "", password: "", passwordConfirm: "" });

  const featureList = useMemo(() => {
    const entries = account?.features ? Object.entries(account.features) : [];
    return entries.filter(([, enabled]) => Boolean(enabled));
  }, [account?.features]);

  const ensureAnonSession = useCallback(async () => {
    const existing = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (existing) return existing;
    const res = await fetch("/api/anon/init", { method: "POST" });
    if (!res.ok) return null;
    const payload = await res.json().catch(() => null);
    const anonId = payload?.anonUserId ?? payload?.anon_id ?? null;
    if (anonId && typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, anonId);
    }
    return anonId;
  }, []);

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await ensureAnonSession();
      const anonId = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      const res = await fetch("/api/me", {
        headers: anonId ? { "x-anon-user-id": anonId } : undefined,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setAccount({ error: payload?.error ?? "account_fetch_failed" });
        setError("계정 정보를 불러오지 못했습니다.");
        return;
      }
      setAccount(payload ?? {});
    } catch {
      setError("계정 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [ensureAnonSession]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await ensureAnonSession();
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizeEmail(login.email),
          password: login.password,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setError("로그인에 실패했습니다.");
        return;
      }
      if (payload?.anonUserId && typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, payload.anonUserId);
      }
      setMessage("로그인 완료");
      await loadAccount();
    } catch {
      setError("로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await ensureAnonSession();
      const anonId = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(anonId ? { "x-anon-user-id": anonId } : {}),
        },
        body: JSON.stringify({
          email: normalizeEmail(signup.email),
          password: signup.password,
          passwordConfirm: signup.passwordConfirm,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setError("회원가입에 실패했습니다.");
        return;
      }
      if (payload?.anonUserId && typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, payload.anonUserId);
      }
      setMessage("회원가입 완료");
      await loadAccount();
    } catch {
      setError("회원가입에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
      setMessage("로그아웃 완료");
      await loadAccount();
    } catch {
      setError("로그아웃에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10 text-sm text-neutral-900">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-[#111111]">내 계정</h1>
          <p className="text-[#666666]">로그인/회원가입 상태와 플랜 정보를 확인합니다.</p>
        </div>
        <a
          href="/settings"
          className="rounded-full border border-[#EAEAEA] bg-white px-3 py-2 text-xs font-semibold text-[#111111] hover:bg-[#FAFAFA]"
          aria-label="계정 설정"
        >
          계정 설정
        </a>
      </header>

      {loading ? <div className="rounded border border-neutral-200 bg-white p-4">불러오는 중...</div> : null}
      {message ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-700" role="status" aria-live="polite">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded border border-rose-200 bg-rose-50 p-3 text-rose-700" role="alert" aria-live="polite">
          {error}
        </div>
      ) : null}

      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">계정 정보</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded border border-neutral-200 bg-white px-3 py-1 text-xs text-[#111111] hover:bg-neutral-50"
              onClick={loadAccount}
            >
              새로고침
            </button>
            <button
              type="button"
              className="rounded border border-neutral-200 bg-white px-3 py-1 text-xs text-[#111111] hover:bg-neutral-50"
              onClick={handleLogout}
              disabled={loading}
              aria-label="로그아웃"
            >
              로그아웃
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-2 text-xs">
          <div>익명 ID: {account?.anonUserId ?? "-"}</div>
          <div>이메일: {account?.email ?? "-"}</div>
          <div>로그인 상태: {account?.isLoggedIn ? "로그인됨" : "비로그인"}</div>
          <div>플랜: {account?.plan?.name ?? "무료"}</div>
        </div>
        {featureList.length ? (
          <div className="mt-4">
            <div className="text-xs font-semibold text-neutral-500">사용 가능한 기능</div>
            <ul className="mt-2 grid gap-1 text-xs text-neutral-600">
              {featureList.map(([key]) => (
                <li key={key}>{key}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="text-sm font-semibold">로그인</div>
          <div className="mt-3 grid gap-2">
            <input
              type="email"
              placeholder="이메일"
              aria-label="로그인 이메일"
              autoComplete="email"
              value={login.email}
              onChange={(e) => setLogin((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full rounded border border-neutral-200 px-3 py-2 text-xs"
            />
            <input
              type="password"
              placeholder="비밀번호"
              aria-label="로그인 비밀번호"
              autoComplete="current-password"
              value={login.password}
              onChange={(e) => setLogin((prev) => ({ ...prev, password: e.target.value }))}
              className="w-full rounded border border-neutral-200 px-3 py-2 text-xs"
            />
            <button
              type="button"
              className="rounded bg-neutral-900 px-3 py-2 text-xs text-white"
              onClick={handleLogin}
              disabled={loading}
            >
              로그인
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="text-sm font-semibold">회원가입</div>
          <div className="mt-3 grid gap-2">
            <input
              type="email"
              placeholder="이메일"
              aria-label="회원가입 이메일"
              autoComplete="email"
              value={signup.email}
              onChange={(e) => setSignup((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full rounded border border-neutral-200 px-3 py-2 text-xs"
            />
            <input
              type="password"
              placeholder="비밀번호"
              aria-label="회원가입 비밀번호"
              autoComplete="new-password"
              value={signup.password}
              onChange={(e) => setSignup((prev) => ({ ...prev, password: e.target.value }))}
              className="w-full rounded border border-neutral-200 px-3 py-2 text-xs"
            />
            <input
              type="password"
              placeholder="비밀번호 확인"
              aria-label="회원가입 비밀번호 확인"
              autoComplete="new-password"
              value={signup.passwordConfirm}
              onChange={(e) => setSignup((prev) => ({ ...prev, passwordConfirm: e.target.value }))}
              className="w-full rounded border border-neutral-200 px-3 py-2 text-xs"
            />
            <button
              type="button"
              className="rounded bg-neutral-900 px-3 py-2 text-xs text-white"
              onClick={handleSignup}
              disabled={loading}
            >
              회원가입
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
