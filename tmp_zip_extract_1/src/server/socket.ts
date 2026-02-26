import { randomUUID } from "crypto";
import type { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import { prisma } from "@/lib/db";
import { getRedis, pushEvent } from "@/lib/redis";
import { storeGhostTrace, getGhostTraces } from "@/lib/ghost";
import { getPageState, removeSession, type SessionBuffer } from "@/server/liveState";
import { resolvePlanFeatures } from "@/lib/plan";

/** move 샘플링: 10~15Hz (66~100ms). PROJECT.md 2-2 */
const MOVE_THROTTLE_MS = 80;
const MAX_BUFFER_POINTS = 500;
const MAX_BUFFER_CLICKS = 200;
const BOUNCE_THRESHOLD_MS = 5000;

function clamp01(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return Math.min(1, Math.max(0, value));
}

function resolvePageId(socket: { handshake: { query: Record<string, unknown> } }) {
  const raw = socket.handshake.query.pageId;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

export function initSocket(server: HttpServer) {
  const io = new Server(server, {
    path: "/socket.io",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    void handleConnection(io, socket);
  });

  return io;
}

async function handleConnection(io: Server, socket: Socket) {
  const pageId = resolvePageId(socket);
  if (!pageId) {
    socket.disconnect();
    return;
  }

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: {
      owner: { include: { plan: true } },
    },
  });

  if (!page || page.status !== "live" || (page.live_expires_at && page.live_expires_at <= new Date())) {
    socket.emit("page:closed");
    socket.disconnect();
    return;
  }

  const features = resolvePlanFeatures(page.owner.plan);
  const replayEnabled = features.replayEnabled;

  const room = `page:${pageId}`;
  socket.join(room);

  const redis = getRedis();
  const state = getPageState(pageId);
  state.viewers.add(socket.id);

  const sessionId = `sess_${randomUUID()}`;
  const startedAt = Date.now();
  const session: SessionBuffer = {
    sessionId,
    pageId,
    startedAt,
    points: [],
    clicks: [],
    lastMoveAt: 0,
  };
  state.sessions.set(socket.id, session);

  try {
    const created = await prisma.liveSession.create({
      data: {
        session_id: sessionId,
        page_id: pageId,
        started_at: new Date(startedAt),
      },
    });
    session.liveSessionId = created.id;
  } catch {
    // Best-effort session logging only.
  }

  try {
    await prisma.page.update({
      where: { id: pageId },
      data: {
        total_visits: { increment: 1 },
        unique_sessions: { increment: 1 },
      },
    });
  } catch {
    // Ignore metrics update failures.
  }

  if (replayEnabled && session.liveSessionId) {
    const referrer = typeof socket.handshake.headers.referer === "string" ? socket.handshake.headers.referer : null;
    const vwRaw = Number(socket.handshake.query.vw);
    const vhRaw = Number(socket.handshake.query.vh);
    const viewportW = Number.isFinite(vwRaw) ? vwRaw : null;
    const viewportH = Number.isFinite(vhRaw) ? vhRaw : null;
    if (redis) {
      pushEvent(redis, {
        page_id: pageId,
        live_session_id: session.liveSessionId,
        type: "enter",
        payload: { referrer, viewport_w: viewportW, viewport_h: viewportH },
      });
    } else {
      void prisma.event
        .create({
          data: {
            page_id: pageId,
            live_session_id: session.liveSessionId,
            type: "enter",
            payload: {
              referrer,
              viewport_w: viewportW,
              viewport_h: viewportH,
            },
          },
        })
        .catch(() => null);
    }
  }

  io.to(room).emit("presence", { count: state.viewers.size });

  // Step 3-2 acceptance: room-scoped presence + click broadcast.
  socket.on("move", (payload) => {
    const now = Date.now();
    if (now - session.lastMoveAt < MOVE_THROTTLE_MS) {
      return;
    }
    session.lastMoveAt = now;

    const x = clamp01(payload?.x);
    const y = clamp01(payload?.y);
    if (x === null || y === null) {
      return;
    }

    // TODO(정책확정 필요): speed-based sampling/hold compression.
    const point = { t: (now - session.startedAt) / 1000, x, y };
    session.points.push(point);
    if (session.points.length > MAX_BUFFER_POINTS) {
      session.points.shift();
    }

    session.lastX = x;
    session.lastY = y;

    if (replayEnabled && session.liveSessionId) {
      if (redis) {
        pushEvent(redis, {
          page_id: pageId,
          live_session_id: session.liveSessionId,
          type: "move",
          x,
          y,
        });
      } else {
        void prisma.event
          .create({
            data: {
              page_id: pageId,
              live_session_id: session.liveSessionId,
              type: "move",
              x,
              y,
            },
          })
          .catch(() => null);
      }
    }

    socket.to(room).emit("live:move", { x, y });
  });

  socket.on("click", (payload) => {
    const x = clamp01(payload?.x);
    const y = clamp01(payload?.y);
    if (x === null || y === null) {
      return;
    }

    const elementId = typeof payload?.elementId === "string" ? payload.elementId : undefined;
    const click = { t: (Date.now() - session.startedAt) / 1000, x, y, el: elementId };
    session.clicks.push(click);
    if (session.clicks.length > MAX_BUFFER_CLICKS) {
      session.clicks.shift();
    }

    if (replayEnabled && session.liveSessionId) {
      if (redis) {
        pushEvent(redis, {
          page_id: pageId,
          live_session_id: session.liveSessionId,
          type: "click",
          x,
          y,
          element_id: elementId ?? null,
        });
      } else {
        void prisma.event
          .create({
            data: {
              page_id: pageId,
              live_session_id: session.liveSessionId,
              type: "click",
              x,
              y,
              element_id: elementId ?? null,
            },
          })
          .catch(() => null);
      }
    }

    void prisma.page
      .update({
        where: { id: pageId },
        data: { total_clicks: { increment: 1 } },
      })
      .catch(() => null);

    socket.to(room).emit("live:click", { x, y });
  });

  socket.on("disconnect", async () => {
    const remaining = removeSession(pageId, socket.id);
    io.to(room).emit("presence", { count: remaining });

    const durationMs = Date.now() - session.startedAt;
    try {
      if (session.liveSessionId) {
        await prisma.liveSession.update({
          where: { id: session.liveSessionId },
          data: {
            ended_at: new Date(),
            duration_ms: Math.max(durationMs, 0),
            last_x: session.lastX,
            last_y: session.lastY,
          },
        });
      }
    } catch {
      // Ignore session update errors.
    }

    try {
      await prisma.$transaction(async (tx) => {
        const current = await tx.page.findUnique({
          where: { id: pageId },
          select: { total_visits: true, total_duration_ms: true, bounce_count: true },
        });

        if (!current) return;

        const bounce = durationMs < BOUNCE_THRESHOLD_MS;
        const totalDuration = current.total_duration_ms + Math.max(durationMs, 0);
        const bounceCount = current.bounce_count + (bounce ? 1 : 0);
        const avg = current.total_visits > 0 ? totalDuration / current.total_visits : 0;
        const bounceRate = current.total_visits > 0 ? bounceCount / current.total_visits : 0;

        await tx.page.update({
          where: { id: pageId },
          data: {
            total_duration_ms: totalDuration,
            avg_duration_ms: avg,
            bounce_count: bounceCount,
            bounce_rate: bounceRate,
          },
        });
      });
    } catch {
      // Ignore metrics update failures.
    }

    if (replayEnabled && session.liveSessionId) {
      if (redis) {
        pushEvent(redis, {
          page_id: pageId,
          live_session_id: session.liveSessionId,
          type: "leave",
          payload: {
            duration_ms: Math.max(durationMs, 0),
            last_x: session.lastX ?? null,
            last_y: session.lastY ?? null,
          },
        });
      } else {
        void prisma.event
          .create({
            data: {
              page_id: pageId,
              live_session_id: session.liveSessionId,
              type: "leave",
              payload: {
                duration_ms: Math.max(durationMs, 0),
                last_x: session.lastX ?? null,
                last_y: session.lastY ?? null,
              },
            },
          })
          .catch(() => null);
      }
    }

    const stored = await storeGhostTrace({
      pageId,
      points: session.points,
      clicks: session.clicks,
      durationMs,
    });

    if (stored) {
      const traces = await getGhostTraces(pageId);
      io.to(room).emit("ghost:update", { traces });
    }
  });
}
