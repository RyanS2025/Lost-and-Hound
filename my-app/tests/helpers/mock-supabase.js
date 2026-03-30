/**
 * Mock Supabase auth responses by intercepting network requests.
 * This prevents real API calls to Supabase during tests.
 */

export async function mockSupabaseAuth(page, options = {}) {
  const supabaseUrl = "https://lzyioxddjcbwgmkgwmjc.supabase.co";

  // Block all real Supabase auth requests by default
  await page.route(`${supabaseUrl}/auth/**`, async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // POST /auth/v1/token (login)
    if (url.includes("/auth/v1/token") && method === "POST") {
      const body = route.request().postDataJSON?.() || {};

      if (options.loginError) {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            error: options.loginError,
            error_description: options.loginErrorDescription || options.loginError,
          }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "mock-access-token",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "mock-refresh-token",
          user: {
            id: "mock-user-id",
            email: body.email || "test@northeastern.edu",
            user_metadata: { first_name: "Test", last_name: "User" },
          },
        }),
      });
    }

    // POST /auth/v1/signup
    if (url.includes("/auth/v1/signup") && method === "POST") {
      if (options.signupError) {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            error: options.signupError,
            error_description: options.signupErrorDescription || options.signupError,
          }),
        });
      }

      if (options.signupExistingUser) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            user: { id: "mock-user-id", identities: [] },
            session: null,
          }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "mock-new-user-id",
            email: "test@northeastern.edu",
            identities: [{ id: "mock-identity" }],
            user_metadata: { first_name: "Test", last_name: "User" },
          },
          session: null,
        }),
      });
    }

    // POST /auth/v1/recover (password reset)
    if (url.includes("/auth/v1/recover") && method === "POST") {
      if (options.resetError) {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: options.resetError }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    }

    // POST /auth/v1/resend
    if (url.includes("/auth/v1/resend") && method === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    }

    // GET /auth/v1/user
    if (url.includes("/auth/v1/user") && method === "GET") {
      if (options.authenticated) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "mock-user-id",
            email: "test@northeastern.edu",
            user_metadata: { first_name: "Test", last_name: "User" },
          }),
        });
      }
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "not authenticated" }),
      });
    }

    // Default: return empty success for unhandled auth routes
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  // Mock the backend API
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();

    if (url.includes("/api/profile") && route.request().method() === "GET") {
      if (options.authenticated) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            first_name: "Test",
            last_name: "User",
            default_campus: "boston",
            is_moderator: false,
          }),
        });
      }
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "No token provided" }),
      });
    }

    if (url.includes("/api/auth/reset-password") && route.request().method() === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    }

    // Let other API calls through or return 404
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Not found" }),
    });
  });
}
