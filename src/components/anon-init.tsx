"use client";

import { useEffect } from "react";

const STORAGE_KEY = "anon_user_id";

export default function AnonInit() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const existing = localStorage.getItem(STORAGE_KEY);

    fetch("/api/anon/init", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(existing ? { "x-anon-user-id": existing } : {}),
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.anonUserId) {
          localStorage.setItem(STORAGE_KEY, data.anonUserId);
        }
      })
      .catch(() => null);
  }, []);

  return null;
}
