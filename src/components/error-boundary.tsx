"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

/** §29.10 에러 바운더리 — 렌더 오류 시 폴백 UI */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-[14px] border border-[#EAEAEA] bg-[#FAFAFA] p-8 text-center">
          <p className="text-sm font-medium text-[#111111]">문제가 발생했습니다.</p>
          <p className="text-xs text-[#666666]">잠시 후 새로고침해 주세요.</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="rounded-[14px] border border-[#111111] bg-white px-4 py-2 text-sm font-medium text-[#111111]"
          >
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
