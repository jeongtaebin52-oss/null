import type { GhostClick, GhostPoint } from "@/lib/ghost-utils";

export type SessionBuffer = {
  sessionId: string;
  pageId: string;
  startedAt: number;
  points: GhostPoint[];
  clicks: GhostClick[];
  lastMoveAt: number;
  lastX?: number;
  lastY?: number;
  liveSessionId?: string;
};

export type PageLiveState = {
  viewers: Set<string>;
  sessions: Map<string, SessionBuffer>;
};

const pageStates = new Map<string, PageLiveState>();

export function getPageState(pageId: string) {
  let state = pageStates.get(pageId);
  if (!state) {
    state = {
      viewers: new Set(),
      sessions: new Map(),
    };
    pageStates.set(pageId, state);
  }
  return state;
}

export function removeSession(pageId: string, socketId: string) {
  const state = pageStates.get(pageId);
  if (!state) {
    return 0;
  }

  state.viewers.delete(socketId);
  state.sessions.delete(socketId);

  const remaining = state.viewers.size;
  if (state.viewers.size === 0) {
    pageStates.delete(pageId);
  }

  return remaining;
}
