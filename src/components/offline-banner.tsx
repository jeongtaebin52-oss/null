"use client";

import { useEffect, useState } from "react";

/** §29.10 네트워크 끊김 "오프라인" 메시지 */
export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(() => (typeof window === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      className="fixed left-0 right-0 top-0 z-[60] bg-[#111111] py-2 text-center text-xs font-medium text-white"
      role="status"
      aria-live="polite"
    >
      오프라인 — 연결을 확인해 주세요.
    </div>
  );
}
