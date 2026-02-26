import { Suspense } from "react";
import SignupPageClient from "./signup-page-client";

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <SignupPageClient />
    </Suspense>
  );
}
