"use client";

import { useState } from "react";
import Link from "next/link";

type LoginFormProps = {
  onSuccess?: () => void;
  next?: string;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export default function LoginForm({ onSuccess, next }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("이메일을 입력해 주세요.");
      return;
    }
    if (!password) {
      setError("비밀번호를 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizeEmail(email),
          password,
          rememberMe: rememberMe || undefined,
          nextPageId: next ? undefined : null,
        }),
        credentials: "include",
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          payload?.error === "invalid_credentials"
            ? "이메일 또는 비밀번호를 확인해 주세요."
            : res.status === 429
              ? payload?.message ?? "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
              : res.status >= 500
                ? "일시적인 오류입니다. 잠시 후 다시 시도해 주세요."
                : payload?.message ?? "로그인에 실패했습니다.";
        setError(msg);
        return;
      }
      if (payload?.anonUserId && typeof localStorage !== "undefined") {
        localStorage.setItem("anon_user_id", payload.anonUserId);
      }
      onSuccess?.();
      const target = next || "/";
      window.location.href = target;
      return;
    } catch {
      setError("로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={(e) => e.key === "Escape" && setError(null)}
      className="flex flex-col gap-4"
    >
      {error ? (
        <div className="rounded-[14px] border border-[#EAEAEA] bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert" aria-live="polite">
          {error}
        </div>
      ) : null}
      <div>
        <label htmlFor="login-email" className="mb-1 block text-xs font-medium text-[#666666]">
          이메일
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          maxLength={255}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-[14px] border border-[#EAEAEA] bg-white px-4 py-3 text-sm text-[#111111]"
          required
        />
      </div>
      <div>
        <label htmlFor="login-password" className="mb-1 block text-xs font-medium text-[#666666]">
          비밀번호
        </label>
        <div className="relative">
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="********"
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-[14px] border border-[#EAEAEA] bg-white px-4 py-3 pr-10 text-sm text-[#111111]"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[11px] text-[#666666] hover:bg-[#EAEAEA]"
            aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
            title={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
          >
            {showPassword ? "숨기기" : "보기"}
          </button>
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-[#666666]">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          className="rounded border-[#EAEAEA]"
          aria-label="로그인 상태 유지"
        />
        로그인 상태 유지
      </label>
      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        aria-label={loading ? "로그인 중" : "로그인"}
        className="w-full rounded-[14px] bg-[#111111] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? "로그인 중..." : "로그인"}
      </button>
      <p className="text-center text-xs text-[#666666]">
        아직 계정이 없나요?{" "}
        <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-medium text-[#111111] underline">
          가입하기
        </Link>
      </p>
    </form>
  );
}
