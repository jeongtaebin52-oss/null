import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * 오름차순 정렬된 양의 정수 배열에서, 1부터 시작해 비어 있는 최소 양의 정수를 반환.
 * [] → 1, [1] → 2, [1,2] → 3, [2] → 1, [1,3] → 2
 */
export function pickSmallestMissingPositive(sortedAnonNumbers: number[]): number {
  let expected = 1;
  for (const n of sortedAnonNumbers) {
    if (n === expected) {
      expected += 1;
      continue;
    }
    if (n > expected) {
      break;
    }
  }
  return expected;
}

export async function allocateAnonNumber(db: DbClient = prisma) {
  const numbers = await db.page.findMany({
    where: { is_deleted: false },
    select: { anon_number: true },
    orderBy: { anon_number: "asc" },
  });

  const sorted = numbers.map((e) => e.anon_number);
  // TODO(정책확정 필요): 동시 생성 경쟁 조건 방지(락/시퀀스) 적용.
  return pickSmallestMissingPositive(sorted);
}

export async function createDraftPage(params: {
  ownerId: string;
  title?: string | null;
  contentJson: Prisma.JsonValue;
}) {
  return prisma.$transaction(async (tx) => {
    const anonNumber = await allocateAnonNumber(tx);
    const page = await tx.page.create({
      data: {
        owner_id: params.ownerId,
        title: params.title ?? null,
        anon_number: anonNumber,
      },
    });

    const version = await tx.pageVersion.create({
      data: {
        page_id: page.id,
        content_json: params.contentJson as Prisma.InputJsonValue,
      },
    });

    await tx.page.update({
      where: { id: page.id },
      data: { current_version_id: version.id },
    });

    return { page, version };
  });
}

export async function savePageVersion(params: {
  pageId: string;
  contentJson: Prisma.JsonValue;
}) {
  return prisma.$transaction(async (tx) => {
    const version = await tx.pageVersion.create({
      data: {
        page_id: params.pageId,
        content_json: params.contentJson as Prisma.InputJsonValue,
      },
    });

    await tx.page.update({
      where: { id: params.pageId },
      data: { current_version_id: version.id },
    });

    return version;
  });
}
