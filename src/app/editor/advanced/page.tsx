'use client';

import { Suspense } from 'react';
import AdvancedEditor from '@/advanced/ui/AdvancedEditor';
import { NullLoadingScreen } from '@/components/null-spinner';

export default function Page() {
  return (
    <Suspense fallback={<NullLoadingScreen label="에디터 불러오는 중..." />}>
      <AdvancedEditor />
    </Suspense>
  );
}
