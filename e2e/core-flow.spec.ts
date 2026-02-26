import { test, expect } from "@playwright/test";

test.describe("core flow", () => {
test("anon login -> editor -> publish -> live -> replay -> library", async ({ page }) => {
  const title = `E2E Test ${Date.now()}`;
  const anonId = `anon_e2e_${Date.now()}`;

  await page.goto("/");
  const cookieHost = new URL(page.url());
  await page.context().addCookies([
    {
      name: "anon_user_id",
      value: anonId,
      domain: cookieHost.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: cookieHost.protocol === "https:",
    },
  ]);

  await page.goto("/login?next=/");
    await expect(page.locator("body")).toBeVisible();
    const anonButton = page.getByRole("button", { name: "익명으로 계속" });
    if (await anonButton.isVisible().catch(() => false)) {
      await anonButton.click();
    }
    await page.waitForURL("**/");

  const authHeaders = { "x-anon-user-id": anonId };
  const meRes = await page.request.get("/api/me", { headers: authHeaders });
  if (!meRes.ok()) {
    throw new Error(`api/me failed: ${meRes.status()} ${await meRes.text()}`);
  }
  const me = await meRes.json();
    expect(me?.anonUserId).toBeTruthy();

  const createRes = await page.request.post("/api/pages", {
    headers: { ...authHeaders, "Content-Type": "application/json" },
    data: {
      title,
      content: { width: 360, height: 640, nodes: [] },
    },
  });
  expect(createRes.ok()).toBeTruthy();
  const created = await createRes.json();
    const pageId = created?.pageId ?? created?.id;
    expect(pageId).toBeTruthy();

  const publishRes = await page.request.post(`/api/pages/${pageId}/publish`, {
    headers: authHeaders,
  });
  expect(publishRes.ok()).toBeTruthy();

    await page.goto(`/editor/advanced?pageId=${pageId}`);
    await expect(page.locator("body")).toBeVisible();

    const liveRes = await page.goto(`/live/${pageId}`);
    expect(liveRes?.status()).toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();

    const replayRes = await page.goto(`/replay/${pageId}`);
    expect(replayRes?.status()).toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText("리플레이는 유료 플랜에서만", { exact: false })).toBeVisible();

    await page.goto("/library");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(title, { exact: false })).toBeVisible();
  });
});
