import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { ensurePlanDefaults } from "@/lib/plan";

const COOKIE_NAME = "anon_user_id";
const HEADER_NAME = "x-anon-user-id";

export async function resolveAnonUserId(req: Request) {
  const cookieStore = await cookies();
  const cookieId = cookieStore.get(COOKIE_NAME)?.value ?? null;
  const headerId = req.headers.get(HEADER_NAME);

  return cookieId ?? headerId;
}

export async function ensureAnonUser(anonUserId: string) {
  await ensurePlanDefaults(prisma);
  let user = await prisma.user.findUnique({
    where: { anon_id: anonUserId },
    include: { plan: true },
  });

  if (!user) {
    try {
      user = await prisma.user.create({
        data: {
          anon_id: anonUserId,
        },
        include: { plan: true },
      });
    } catch {
      user = await prisma.user.findUnique({
        where: { anon_id: anonUserId },
        include: { plan: true },
      });
    }
  }

  return user;
}
