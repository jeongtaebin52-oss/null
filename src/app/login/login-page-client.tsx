"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import LoginForm from "@/components/login-form";

function getSafeNext(raw: string | null) {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  return raw;
}

export default function LoginPageClient() {
  const searchParams = useSearchParams();
  const next = getSafeNext(searchParams.get("next"));

  const [anonLoading, setAnonLoading] = useState(false);
  const [anonError, setAnonError] = useState<string | null>(null);

  const handleAnonContinue = useCallback(async () => {
    setAnonError(null);
    setAnonLoading(true);
    try {
      const res = await fetch("/api/anon/init", { method: "POST", credentials: "include" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          res.status === 429
            ? payload?.message ?? "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
            : payload?.message ?? "익명 세션을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.";
        setAnonError(msg);
        return;
      }
      if (payload?.anonUserId && typeof localStorage !== "undefined") {
        localStorage.setItem("anon_user_id", payload.anonUserId);
      }
      window.location.href = next;
    } catch {
      setAnonError("익명 세션을 시작하지 못했습니다.");
    } finally {
      setAnonLoading(false);
    }
  }, [next]);

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
        <header className="mb-8 text-center">
          <Link href="/" className="text-2xl font-semibold text-[#111111]">
            NULL
          </Link>
          <p className="mt-2 text-sm text-[#666666]">로그인하거나 익명으로 둘러보세요.</p>
        </header>

        <section className="rounded-[14px] border border-[#EAEAEA] bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <h2 className="mb-4 text-sm font-semibold text-[#111111]">로그인</h2>
          <LoginForm next={next} />
        </section>

        <div className="my-6 flex items-center gap-4">
          <span className="h-px flex-1 bg-[#EAEAEA]" />
          <span className="text-xs text-[#666666]">또는</span>
          <span className="h-px flex-1 bg-[#EAEAEA]" />
        </div>

        <section>
          <button
            type="button"
            onClick={handleAnonContinue}
            disabled={anonLoading}
            aria-busy={anonLoading}
            aria-label={anonLoading ? "처리 중" : "익명으로 계속"}
            className="w-full rounded-[14px] border border-[#111111] bg-white px-4 py-3 text-sm font-semibold text-[#111111] disabled:opacity-60"
          >
            {anonLoading ? "처리 중..." : "익명으로 계속"}
          </button>
          {anonError ? (
            <p className="mt-3 text-center text-xs text-rose-600" role="alert">
              {anonError}
            </p>
          ) : null}
        </section>

        <p className="mt-8 text-center text-xs text-[#666666]">
          <Link href="/" className="underline">
            돌아가기
          </Link>
        </p>
      </div>
    </div>
  );
}
