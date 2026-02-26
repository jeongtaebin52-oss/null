'use client';

import { Suspense } from 'react';
import AdvancedEditor from '@/advanced/ui/AdvancedEditor';

export default function Page() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">로딩 중...</div>}>
      <AdvancedEditor />
    </Suspense>
  );
}
