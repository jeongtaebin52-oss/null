import { Suspense } from "react";
import EditorView from "@/components/editor-view";
import { NullLoadingScreen } from "@/components/null-spinner";

export default function EditorPage() {
  return (
    <Suspense fallback={<NullLoadingScreen label="에디터 불러오는 중..." />}>
      <EditorView />
    </Suspense>
  );
}
