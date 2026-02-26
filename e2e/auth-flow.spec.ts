import { test, expect } from "@playwright/test";

test.describe("auth flow", () => {
  test("signup -> logout -> login", async ({ page }) => {
    const clientIp = `127.0.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`;
    await page.route("**/api/auth/signup", (route) => {
      const headers = { ...route.request().headers(), "x-forwarded-for": clientIp };
      route.continue({ headers });
    });
    await page.route("**/api/auth/login", (route) => {
      const headers = { ...route.request().headers(), "x-forwarded-for": clientIp };
      route.continue({ headers });
    });

    const email = `e2e_${Date.now()}@local.test`;
    const password = "Test1234!";

    await page.goto("/signup");
    await page.locator("#signup-email").fill(email);
    await page.locator("#signup-password").fill(password);
    await page.locator("#signup-password-confirm").fill(password);
    await page.locator("#signup-terms-label input").check();
    await page.locator("form button[type='submit']").click();
    await page.waitForURL("**/");

    const anonUserId = await page.evaluate(() => localStorage.getItem("anon_user_id"));
    expect(anonUserId).toBeTruthy();
    const meRes = await page.request.get("/api/me", { headers: { "x-anon-user-id": anonUserId! } });
    expect(meRes.ok()).toBeTruthy();
    const me = await meRes.json();
    expect(me?.email).toBe(email);

    await page.evaluate(async () => {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    });

    await page.goto("/login");
    await page.locator("#login-email").fill(email);
    await page.locator("#login-password").fill(password);
    await page.locator("form button[type='submit']").click();
    await page.waitForURL("**/");

    const anonUserIdAfter = await page.evaluate(() => localStorage.getItem("anon_user_id"));
    expect(anonUserIdAfter).toBeTruthy();
    const meResAfter = await page.request.get("/api/me", { headers: { "x-anon-user-id": anonUserIdAfter! } });
    expect(meResAfter.ok()).toBeTruthy();
    const meAfter = await meResAfter.json();
    expect(meAfter?.email).toBe(email);
  });
});
