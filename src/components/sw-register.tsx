"use client";

import { useEffect } from "react";

export default function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => null);
  }, []);
  return null;
}
