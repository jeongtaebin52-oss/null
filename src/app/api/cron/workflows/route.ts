import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-handler";
import { runScheduledWorkflows } from "@/lib/workflow-scheduler";

function requireCronSecret(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;
  const provided = req.headers.get("x-null-cron-secret");
  if (provided !== secret) return "forbidden";
  return null;
}

async function handleRun(req: Request) {
  const secretError = requireCronSecret(req);
  if (secretError) return NextResponse.json({ error: secretError }, { status: 401 });

  const summary = await runScheduledWorkflows(new Date());
  return NextResponse.json(summary);
}

export const GET = withErrorHandler(handleRun);
export const POST = withErrorHandler(handleRun);
