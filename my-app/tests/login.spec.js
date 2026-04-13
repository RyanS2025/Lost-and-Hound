import { test, expect } from "@playwright/test";
import { mockSupabaseAuth } from "./helpers/mock-supabase.js";

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabaseAuth(page);
    await page.goto("/");
  });

  test("renders the login form", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("shows Lost & Hound branding", async ({ page }) => {
    await expect(page.getByRole("img", { name: "Lost & Hound" })).toBeVisible();
    await expect(page.getByText("Find What's Lost")).toBeVisible();
    await expect(page.getByText("Help What's Found")).toBeVisible();
  });

  test("shows error for empty email", async ({ page }) => {
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toContainText("email");
  });

  test("shows error for non-northeastern email", async ({ page }) => {
    await page.getByRole("textbox", { name: "Email" }).fill("test@gmail.com");
    await page.getByRole("textbox", { name: "Password" }).fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toContainText("northeastern.edu");
  });

  test("shows error for empty password", async ({ page }) => {
    await page.getByRole("textbox", { name: "Email" }).fill("test@northeastern.edu");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("shows error for incorrect credentials", async ({ page }) => {
    await mockSupabaseAuth(page, {
      loginError: "invalid_grant",
      loginErrorDescription: "Invalid login credentials",
    });
    await page.getByRole("textbox", { name: "Email" }).fill("test@northeastern.edu");
    await page.getByRole("textbox", { name: "Password" }).fill("wrongpassword");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("shows email not confirmed error with resend button", async ({ page }) => {
    await mockSupabaseAuth(page, {
      loginError: "email_not_confirmed",
      loginErrorDescription: "Email not confirmed",
    });
    await page.getByRole("textbox", { name: "Email" }).fill("test@northeastern.edu");
    await page.getByRole("textbox", { name: "Password" }).fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Email not confirmed")).toBeVisible();
    await expect(page.getByText("Resend verification email")).toBeVisible();
  });

  test("resend verification email button works", async ({ page }) => {
    await mockSupabaseAuth(page, {
      loginError: "email_not_confirmed",
      loginErrorDescription: "Email not confirmed",
    });
    await page.getByRole("textbox", { name: "Email" }).fill("test@northeastern.edu");
    await page.getByRole("textbox", { name: "Password" }).fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Resend verification email")).toBeVisible();
    await page.getByText("Resend verification email").click();
    await expect(page.getByText("Verification email resent")).toBeVisible();
  });

  test("forgot password link navigates to forgot password page", async ({ page }) => {
    await page.getByText("Forgot password?").click();
    await expect(page).toHaveURL("/forgot-password");
  });

  test("sign up link switches to signup form", async ({ page }) => {
    await page.getByRole("button", { name: "Sign Up" }).click();
    await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "First Name" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Last Name" })).toBeVisible();
  });

  test("password field enforces max length of 32 characters", async ({ page }) => {
    const longPassword = "a".repeat(40);
    await page.getByRole("textbox", { name: "Password" }).fill(longPassword);
    const value = await page.getByRole("textbox", { name: "Password" }).inputValue();
    expect(value.length).toBeLessThanOrEqual(32);
  });
});
