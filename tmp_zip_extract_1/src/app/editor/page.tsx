import { Suspense } from "react";
import EditorView from "@/components/editor-view";

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">로딩 중...</div>}>
      <EditorView />
    </Suspense>
  );
}
