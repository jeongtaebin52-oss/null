import { z, type ZodType } from "zod";
import { apiErrorJson } from "@/lib/api-error";

export type ValidationResult<T> = { data: T; error: null } | { data: null; error: ReturnType<typeof apiErrorJson> };

export const looseObjectSchema = z.object({}).passthrough();

export async function parseJsonBody<T>(req: Request, schema: ZodType<T>): Promise<ValidationResult<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { data: null, error: apiErrorJson("invalid_body", 400, "요청 본문이 올바르지 않습니다.") };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { data: null, error: apiErrorJson("invalid_body", 400, "요청 본문이 올바르지 않습니다.") };
  }

  return { data: parsed.data, error: null };
}

export async function parseJsonObject(req: Request): Promise<ValidationResult<Record<string, unknown>>> {
  return parseJsonBody(req, looseObjectSchema);
}

export function parseSearchParams<T>(
  params: URLSearchParams,
  schema: ZodType<T>,
  errorCode = "invalid_query",
  message = "요청 파라미터가 올바르지 않습니다."
): ValidationResult<T> {
  const raw = Object.fromEntries(params.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { data: null, error: apiErrorJson(errorCode, 400, message) };
  }
  return { data: parsed.data, error: null };
}
