import { test, expect } from "@playwright/test";
import { mockSupabaseAuth } from "./helpers/mock-supabase.js";

test.describe("Navigation & Routing", () => {
  test("unauthenticated user sees login page at /", async ({ page }) => {
    await mockSupabaseAuth(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("unauthenticated user can access /forgot-password", async ({ page }) => {
    await mockSupabaseAuth(page);
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: "Reset Password" })).toBeVisible();
  });

  test("unauthenticated user can access /reset-password", async ({ page }) => {
    await mockSupabaseAuth(page);
    await page.goto("/reset-password");
    await expect(page.getByRole("heading", { name: "Set New Password" })).toBeVisible();
  });

  test("unknown routes show login page for unauthenticated users", async ({ page }) => {
    await mockSupabaseAuth(page);
    await page.goto("/some-random-page");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("navigate from login to forgot password and back", async ({ page }) => {
    await mockSupabaseAuth(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    // Go to forgot password
    await page.getByText("Forgot password?").click();
    await expect(page).toHaveURL("/forgot-password");
    await expect(page.getByRole("heading", { name: "Reset Password" })).toBeVisible();

    // Go back to login
    await page.getByText("Back to Sign In").click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("navigate from login to signup and back", async ({ page }) => {
    await mockSupabaseAuth(page);
    await page.goto("/");

    // Switch to signup
    await page.getByRole("button", { name: "Sign Up" }).click();
    await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible();

    // Switch back to login
    await page.getByRole("button", { name: "Log In" }).click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("password recovery URL params detected on page load", async ({ page }) => {
    await mockSupabaseAuth(page);
    // Simulate arriving with recovery token_hash in URL
    await page.goto("/?token_hash=fake_token&type=recovery");
    // The app should detect this and show the reset password page
    // (verifyOtp will fail with mock, but isPasswordRecovery should be true initially)
    await expect(page.getByRole("heading", { name: "Set New Password" })).toBeVisible();
  });
});

test.describe("Page Content & Accessibility", () => {
  test("login page has proper form labels", async ({ page }) => {
    await mockSupabaseAuth(page);
    await page.goto("/");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("forgot password page has proper form labels", async ({ page }) => {
    await mockSupabaseAuth(page);
    await page.goto("/forgot-password");
    await expect(page.getByLabel("Email Address")).toBeVisible();
  });

  test("reset password page has proper form labels", async ({ page }) => {
    await mockSupabaseAuth(page);
    await page.goto("/reset-password");
    await expect(page.getByLabel("New Password")).toBeVisible();
    await expect(page.getByLabel("Confirm Password")).toBeVisible();
  });

  test("pages are responsive at mobile width", async ({ page }) => {
    await mockSupabaseAuth(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("forgot password page is responsive at mobile width", async ({ page }) => {
    await mockSupabaseAuth(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: "Reset Password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send Reset Link" })).toBeVisible();
  });
});
