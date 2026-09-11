/**
 * Stubs a logged-in feed session.
 *
 * tests/helpers/mock-supabase.js only models /auth/** plus /api/profile, and
 * 404s everything else under /api/**. Anything that renders the feed therefore
 * needs its own route stubs, which is what this adds.
 *
 * Register AFTER mockSupabaseAuth — Playwright's last-registered route wins.
 */

export const SAMPLE_LISTING = {
  item_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  title: "Black Jansport backpack",
  category: "Bag",
  location_id: 1,
  found_at: "second floor",
  importance: 2,
  description: "black jansport.",
  image_url: null,
  image_redacted: true,
  listing_type: "found",
  resolved: false,
  poster_id: "mock-user-id",
  poster_name: "Test User",
  date: "2026-09-01T12:00:00.000Z",
  lat: null,
  lng: null,
  locations: { name: "Snell Library", coordinates: null, campus: "boston" },
};

/**
 * Seed a Supabase session into localStorage.
 *
 * mockSupabaseAuth only intercepts /auth/** network calls, but the client
 * restores a session from localStorage via getSession() without going to the
 * network at all — so route mocking alone leaves the app on the login screen.
 * This is what actually makes a test "logged in".
 */
export async function seedSession(page) {
  const projectRef = "lzyioxddjcbwgmkgwmjc";
  const session = {
    access_token: "mock-access-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "mock-refresh-token",
    user: {
      id: "mock-user-id",
      aud: "authenticated",
      role: "authenticated",
      email: "test@northeastern.edu",
      app_metadata: { provider: "email" },
      user_metadata: { first_name: "Test", last_name: "User" },
      created_at: "2026-01-01T00:00:00.000Z",
    },
  };

  await page.addInitScript(
    ([ref, sess]) => {
      window.localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(sess));
      // The backend's require2FA accepts a trusted-device token; the frontend
      // reads this from localStorage and sends it as X-Device-Token.
      window.localStorage.setItem("device_token", "mock-device-token");
    },
    [projectRef, session]
  );
}

export async function mockFeed(page, options = {}) {
  const listings = options.listings ?? [SAMPLE_LISTING];

  await seedSession(page);

  await page.route("**/api/profile**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "mock-user-id",
        first_name: "Test",
        last_name: "User",
        default_campus: "boston",
        is_moderator: false,
        is_owner: false,
        points: 0,
        referral_answered: true,
        email_notifications_enabled: true,
        push_notifications_enabled: true,
        broadcast_notifications_enabled: true,
        banned_until: null,
      }),
    })
  );

  await page.route("**/api/locations**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { location_id: 1, name: "Snell Library", campus: "boston", coordinates: null },
        { location_id: 2, name: "Curry Student Center", campus: "boston", coordinates: null },
      ]),
    })
  );

  await page.route("**/api/listings**", async (route) => {
    const url = new URL(route.request().url());
    // The glob also matches /api/listings/cleanup, which the app fires on load.
    // Only a POST to the bare collection is a listing creation.
    const isCreate =
      route.request().method() === "POST" && url.pathname === "/api/listings";

    if (isCreate) {
      const body = route.request().postDataJSON?.() || {};
      options.onCreate?.(body);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...SAMPLE_LISTING,
          item_id: "11111111-2222-3333-4444-555555555555",
          title: body.title,
          description: body.description,
          image_url: body.image_url ?? null,
          image_redacted: body.image_redacted === true,
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: listings,
        page: 1,
        limit: 10,
        total: listings.length,
        hasMore: false,
      }),
    });
  });

  await page.route("**/api/stats**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );
}

/**
 * Stubs the three-step upload so a test can drive the screening outcome.
 * `verify` is the JSON the /api/verify-image stub returns, with its status.
 */
export async function mockUpload(page, verify) {
  await page.route("**/api/upload-url**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        signedUrl: "https://storage.example.test/signed-put",
        publicUrl:
          "https://example-project.supabase.co/storage/v1/object/public/listing-images/mock-user-id/1-x.jpg",
        path: "mock-user-id/1-x.jpg",
      }),
    })
  );

  await page.route("https://storage.example.test/**", (route) =>
    route.fulfill({ status: 200, body: "" })
  );

  await page.route("**/api/verify-image**", (route) =>
    route.fulfill({
      status: verify.status,
      contentType: "application/json",
      body: JSON.stringify(verify.body),
    })
  );
}
