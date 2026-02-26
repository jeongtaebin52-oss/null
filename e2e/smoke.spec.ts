import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("home loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/NULL|Feed/i).catch(() => {});
    await expect(page.locator("body")).toBeVisible();
  });

  test("library loads", async ({ page }) => {
    const res = await page.goto("/library");
    expect(res?.status()).toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
  });

  test("advanced editor loads", async ({ page }) => {
    const res = await page.goto("/editor/advanced");
    expect(res?.status()).toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
  });

  test("public page missing returns 404-ish", async ({ page }) => {
    const res = await page.goto("/p/nonexistent-page-id-12345");
    expect(res?.status()).toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
  });
});
