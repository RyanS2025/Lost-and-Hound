import { test, expect } from "@playwright/test";
import { mockSupabaseAuth } from "./helpers/mock-supabase.js";
import { mockFeed } from "./helpers/mock-feed.js";

// The preview panel runs the SAME module the server runs — the two copies are
// held byte-identical by scripts/check-splitter-sync.sh. These tests assert the
// student is shown the real outcome, not an approximation of it.

test.describe("Description auto-sorter preview", () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabaseAuth(page, { authenticated: true });
    await mockFeed(page);
    await page.goto("/");
  });

  // The panel, not the whole page: the description text is also present in the
  // textarea the student is typing into, so an unscoped matcher is ambiguous.
  const preview = (page) => page.getByText("WHAT EVERYONE ELSE WILL SEE").locator("..");

  const openComposer = async (page) => {
    await page.getByRole("button", { name: "Report Item" }).click();
    await expect(page.getByRole("textbox", { name: /description/i })).toBeVisible();
  };

  test("shows the redacted public text and a chip per withheld reason", async ({ page }) => {
    await openComposer(page);
    await page
      .getByRole("textbox", { name: /description/i })
      .fill("black jansport, math textbook inside, keychain w/ blue dolphin");

    await expect(preview(page)).toContainText("black jansport.");
    await expect(preview(page)).toContainText("contents");
    await expect(preview(page)).toContainText("stickers & charms");
    // The specifics must not survive into the public half.
    await expect(preview(page)).not.toContainText("math textbook");
    await expect(preview(page)).not.toContainText("dolphin");
  });

  test("the withheld specifics do not appear in the preview", async ({ page }) => {
    await openComposer(page);
    await page
      .getByRole("textbox", { name: /description/i })
      .fill("blue case, serial F2LX9K2M, lock screen is a photo of my dog");

    await expect(preview(page)).not.toContainText("F2LX9K2M");
    await expect(preview(page)).not.toContainText("serial");
    await expect(preview(page)).toContainText("blue case.");
  });

  test("the preview is read-only — the split is not negotiable", async ({ page }) => {
    // Letting the poster edit the public text would hand the security boundary
    // back to the person we already know will not withhold specifics.
    await openComposer(page);
    await page.getByRole("textbox", { name: /description/i }).fill("wallet, PIN is 4821");

    await expect(preview(page).getByRole("textbox")).toHaveCount(0);
  });

  test("an all-specifics description shows the fallback and a nudge", async ({ page }) => {
    await openComposer(page);
    await page
      .getByRole("textbox", { name: /description/i })
      .fill("NUID 001234567, engraved J.R. on the back, $40 cash inside");

    await expect(page.getByText(/Details withheld/i)).toBeVisible();
    await expect(page.getByText(/Add a line about the colour/i)).toBeVisible();
  });

  test("a description with nothing to withhold is shown unchanged", async ({ page }) => {
    await openComposer(page);
    // No size here on purpose. A stated size IS withheld (SIZE_RE — "what size
    // is it?" is a desk verification question), so the original fixture for
    // this test described a split, not a pass-through.
    const text = "Grey Patagonia fleece, found on a bench outside Snell";
    await page.getByRole("textbox", { name: /description/i }).fill(text);

    await expect(preview(page)).toContainText(text);
  });
});

test.describe("description_internal never reaches a non-staff client", () => {
  test("no API response on the feed contains the column", async ({ page }) => {
    // Broader than asserting on one endpoint: this also catches a future route
    // that quietly regresses to select("*").
    const offenders = [];
    page.on("response", async (res) => {
      if (!res.url().includes("/api/")) return;
      const body = await res.text().catch(() => "");
      if (body.includes("description_internal")) offenders.push(res.url());
    });

    await mockSupabaseAuth(page, { authenticated: true });
    await mockFeed(page);
    await page.goto("/");
    await page.waitForTimeout(1500);

    expect(offenders, `description_internal leaked from: ${offenders.join(", ")}`).toEqual([]);
  });
});
