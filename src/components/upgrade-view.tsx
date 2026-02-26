"use client";

import { useEffect, useState } from "react";

type PlanInfo = {
  id: string;
  name: string;
  price: string;
  features: string[];
};

const plans: PlanInfo[] = [
  {
    id: "standard",
    name: "스탠다드",
    price: "월 19,900원",
    features: ["임시 공개 2개", "리플레이 24시간", "기본 분석"],
  },
  {
    id: "pro",
    name: "프로",
    price: "월 39,000원",
    features: ["임시 공개 4개", "리플레이 24시간", "고급 분석"],
  },
  {
    id: "enterprise",
    name: "엔터프라이즈",
    price: "문의",
    features: ["대규모 계정", "전용 기능", "맞춤 리포트"],
  },
];

export default function UpgradeView() {
  const [currentPlan, setCurrentPlan] = useState("free");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.plan?.id) setCurrentPlan(data.plan.id);
      })
      .catch(() => null);
  }, []);

  async function upgrade(targetPlan: string) {
    setMessage(null);
    const res = await fetch("/api/billing/upgrade", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPlan }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      if (data?.redirectUrl) {
        window.location.assign(data.redirectUrl);
        return;
      }
      setMessage("플랜이 업데이트됐어요.");
      setCurrentPlan(data?.plan ?? targetPlan);
      return;
    }
    setMessage(data?.message ?? data?.error ?? "업그레이드에 실패했어요.");
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF] px-6 py-8 text-sm text-[#111111]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <div className="text-lg font-semibold">플랜 업그레이드</div>
          <span className="rounded-full border border-[#EAEAEA] px-3 py-1 text-xs text-[#666666]">
            현재: {currentPlan.toUpperCase()}
          </span>
        </header>
        {message ? (
          <div className="flex flex-wrap items-center gap-2" role="status" aria-live="polite">
            <span className="text-xs text-[#666666]">{message}</span>
            <button
              type="button"
              onClick={() => setMessage(null)}
              className="rounded-full border border-[#EAEAEA] px-3 py-1 text-xs text-[#111111]"
            >
              닫기
            </button>
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-[14px] border border-[#EAEAEA] bg-white p-5">
              <div className="text-sm font-semibold">{plan.name}</div>
              <div className="mt-1 text-xs text-neutral-500">{plan.price}</div>
              <ul className="mt-4 flex flex-col gap-2 text-xs text-neutral-600">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => upgrade(plan.id)}
                disabled={plan.id === currentPlan}
                className="mt-4 w-full rounded-full border border-[#111111] bg-[#111111] px-4 py-2 text-xs font-semibold text-[#FFFFFF] disabled:opacity-50"
              >
                {plan.id === currentPlan ? "사용 중" : "선택"}
              </button>
            </div>
          ))}
        </div>
        <div className="rounded-[14px] border border-[#EAEAEA] bg-white p-4 text-xs text-[#666666]">
          Stripe 설정 시 결제 페이지로 이동합니다. Mock 모드에서는 즉시 플랜이 반영됩니다.
        </div>
      </div>
    </div>
  );
}
