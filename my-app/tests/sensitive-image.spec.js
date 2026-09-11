import { test, expect } from "@playwright/test";
import { mockSupabaseAuth } from "./helpers/mock-supabase.js";
import { mockFeed, mockUpload, SAMPLE_LISTING } from "./helpers/mock-feed.js";

// The harness only starts Vite, so these stub the API rather than exercising
// it. The backend behaviour they stand in for is covered by the node:test
// suite in my-app/backend/test/.

/**
 * Fill every field the submit button requires: title, building, specific spot
 * and description. `valid` in FeedPage gates on all four plus location_id.
 */
async function fillComposer(page, { title, description }) {
  await page.getByRole("button", { name: "Report Item" }).click();
  await page.getByRole("textbox", { name: "Item Name" }).fill(title);

  await page.getByRole("combobox", { name: "Building" }).click();
  await page.getByRole("option", { name: "Snell Library" }).click();

  await page.getByRole("textbox", { name: /specific spot/i }).fill("second floor");
  await page.getByRole("textbox", { name: "Description" }).fill(description);
}

const JPEG = {
  name: "photo.jpg",
  mimeType: "image/jpeg",
  buffer: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(64)]),
};

test.describe("Blocked photo", () => {
  test("the listing is still created, with a hidden-photo tile", async ({ page }) => {
    // The key product decision: a blocked photo must not cost the student
    // their post. A lost Husky Card with no photo still needs to reach the
    // feed — that is the whole reason the tile exists.
    let created = null;

    await mockSupabaseAuth(page, { authenticated: true });
    await mockFeed(page, { onCreate: (body) => { created = body; } });
    await mockUpload(page, {
      status: 422,
      body: {
        error: "This photo looks like an ID, bank card, or personal document, so it wasn't saved.",
        code: "IMAGE_BLOCKED",
        tier: "payment",
        redactionToken: "v1.fake.token",
      },
    });

    await page.goto("/");
    await fillComposer(page, {
      title: "Found a wallet",
      description: "brown leather, found by the stairs",
    });
    await page.setInputFiles('input[type="file"]', JPEG);
    await page.getByRole("button", { name: "Post Listing" }).click();

    await expect(page.getByText(/photo was hidden/i)).toBeVisible({ timeout: 10000 });
    expect(created, "the listing POST must still have been sent").not.toBeNull();
    expect(created.image_redacted).toBe(true);
    expect(created.image_url ?? null).toBeNull();
    expect(created.upload_token).toBe("v1.fake.token");
  });

  test("screening being unavailable does NOT create a listing", async ({ page }) => {
    // Distinct from a block: nothing is known about the photo, so the user is
    // asked to retry rather than having a post silently go up without it.
    let posted = false;

    await mockSupabaseAuth(page, { authenticated: true });
    await mockFeed(page, { onCreate: () => { posted = true; } });
    await mockUpload(page, {
      status: 503,
      body: { error: "We couldn't check your photo right now.", code: "SCREENING_UNAVAILABLE" },
    });

    await page.goto("/");
    await fillComposer(page, {
      title: "Found keys",
      description: "silver keyring by the door",
    });
    await page.setInputFiles('input[type="file"]', JPEG);
    await page.getByRole("button", { name: "Post Listing" }).click();

    await expect(page.getByText(/couldn't check your photo/i)).toBeVisible({ timeout: 10000 });
    expect(posted, "no listing should be created when screening is unavailable").toBe(false);
  });
});

test.describe("Hidden-photo tile", () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabaseAuth(page, { authenticated: true });
    await mockFeed(page, { listings: [{ ...SAMPLE_LISTING, image_redacted: true, image_url: null }] });
    await page.goto("/");
  });

  test("renders on the feed card", async ({ page }) => {
    await expect(
      page.getByRole("img", { name: /Photo hidden/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("the detail view explains itself and offers no lightbox", async ({ page }) => {
    // There is no full-size version to open, and offering one would imply the
    // photo still exists somewhere.
    await page.getByText(SAMPLE_LISTING.title).first().click();

    const tile = page.getByRole("img", { name: /Photo hidden/i }).first();
    await expect(tile).toBeVisible();
    await expect(page.getByText(/never saved/i)).toBeVisible();

    await tile.click();
    await expect(page.getByText(/never saved/i)).toBeVisible();
  });
});
