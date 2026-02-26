import { prisma } from "@/lib/db";
import { executeWorkflow, type WorkflowTrigger } from "@/lib/app-workflow";
import { matchesCron } from "@/lib/cron";

export type RunResult = {
  workflowId: string;
  name: string;
  status: "success" | "error";
  logs: string[];
  error?: string;
  skipped?: boolean;
};

export type ScheduledRunSummary = {
  ok: true;
  checkedAt: string;
  matched: number;
  ran: number;
  skipped: number;
  results: RunResult[];
};

export async function runScheduledWorkflows(now: Date = new Date()): Promise<ScheduledRunSummary> {
  const workflows = await prisma.appWorkflow.findMany({
    where: { enabled: true },
    select: { id: true, name: true, page_id: true, trigger: true },
  });

  const candidates = workflows.filter((w) => {
    const trigger = w.trigger as WorkflowTrigger;
    if (trigger.type !== "schedule") return false;
    const cron = String(trigger.cron ?? "");
    const match = matchesCron(cron, now);
    return match.ok && match.matches;
  });

  const start = new Date(now);
  start.setSeconds(0, 0);
  const end = new Date(start.getTime() + 60 * 1000);
  const recent = await prisma.appWorkflowLog.findMany({
    where: {
      workflow_id: { in: candidates.map((c) => c.id) },
      started_at: { gte: start, lt: end },
    },
    select: { workflow_id: true },
  });
  const ran = new Set(recent.map((r) => r.workflow_id));

  const results: RunResult[] = [];
  for (const w of candidates) {
    if (ran.has(w.id)) {
      results.push({ workflowId: w.id, name: w.name, status: "success", logs: [], skipped: true });
      continue;
    }
    const result = await executeWorkflow(w.id, w.page_id);
    results.push({ workflowId: w.id, name: w.name, ...result });
  }

  return {
    ok: true,
    checkedAt: now.toISOString(),
    matched: candidates.length,
    ran: results.filter((r) => !r.skipped).length,
    skipped: results.filter((r) => r.skipped).length,
    results,
  };
}
