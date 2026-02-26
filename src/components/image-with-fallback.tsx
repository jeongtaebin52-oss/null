"use client";

import { useState } from "react";

type Props = {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  /** §29.2 이미지 로드 실패 시 대체 메시지 */
  fallbackText?: string;
};

export default function ImageWithFallback({ src, alt = "", className, style, fallbackText = "이미지를 불러올 수 없습니다." }: Props) {
  const [error, setError] = useState(false);
  if (!src) {
    return (
      <div className={className} style={style}>
        <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">이미지</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className={className} style={style}>
        <div className="flex h-full w-full items-center justify-center bg-neutral-100 px-2 py-1 text-center text-[10px] text-neutral-500">
          {fallbackText}
        </div>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={() => setError(true)}
    />
  );
}
