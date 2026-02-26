import { NextResponse } from "next/server";

type ApiErrorOptions = {
  message?: string;
  requestId?: string;
  headers?: HeadersInit;
  detail?: unknown;
  extra?: Record<string, unknown>;
};

/** §29.10 API 에러 일관된 JSON: { ok:false, error, message, request_id? } + status */
export function apiErrorJson(
  error: string,
  status: number,
  messageOrOptions?: string | ApiErrorOptions
): NextResponse {
  const fallback =
    status >= 500
      ? "잠시 후 다시 시도해 주세요."
      : status === 429
        ? "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
        : status === 404
          ? "요청한 리소스를 찾을 수 없습니다."
          : "잠시 후 다시 시도해 주세요.";
  const message =
    typeof messageOrOptions === "string"
      ? messageOrOptions
      : messageOrOptions && typeof messageOrOptions === "object"
        ? messageOrOptions.message
        : undefined;
  const requestId =
    typeof messageOrOptions === "object" && messageOrOptions !== null
      ? messageOrOptions.requestId
      : undefined;
  const headers =
    typeof messageOrOptions === "object" && messageOrOptions !== null
      ? messageOrOptions.headers
      : undefined;
  const detail =
    typeof messageOrOptions === "object" && messageOrOptions !== null
      ? messageOrOptions.detail
      : undefined;
  const extra =
    typeof messageOrOptions === "object" && messageOrOptions !== null
      ? messageOrOptions.extra
      : undefined;
  return NextResponse.json(
    {
      ok: false,
      error,
      message: message ?? fallback,
      ...(requestId ? { request_id: requestId } : {}),
      ...(detail !== undefined ? { detail } : {}),
      ...(extra ? extra : {}),
    },
    { status, headers }
  );
}
