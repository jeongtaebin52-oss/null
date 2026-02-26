export function getCollabInviteFromRequest(req: Request) {
  const raw = req.headers.get("x-collab-invite");
  const value = raw?.trim();
  return value ? value : null;
}

export function isCollabInviteValid(
  invite: string | null,
  page: { collab_invite_code: string | null; collab_invite_enabled: boolean }
) {
  if (!invite) return false;
  if (!page.collab_invite_enabled) return false;
  return page.collab_invite_code === invite;
}
