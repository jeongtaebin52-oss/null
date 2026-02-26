"use client";

import { useEffect, useMemo, useState } from "react";

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(total / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export default function Countdown({ expiresAt }: { expiresAt: string | Date }) {
  const initial = useMemo(() => (typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt), [expiresAt]);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => setRemaining(initial.getTime() - Date.now());
    Promise.resolve().then(update);
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [initial]);

  return <span>{formatRemaining(remaining)}</span>;
}
