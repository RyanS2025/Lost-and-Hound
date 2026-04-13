import { test, expect } from "@playwright/test";
import { mockSupabaseAuth } from "./helpers/mock-supabase.js";

test.describe("Forgot Password Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabaseAuth(page);
    await page.goto("/forgot-password");
  });

  test("renders the forgot password form", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Reset Password" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email Address" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send Reset Link" })).toBeVisible();
    await expect(page.getByText("Back to Sign In")).toBeVisible();
  });

  test("shows lock reset icon", async ({ page }) => {
    await expect(page.getByText("Enter your Northeastern email")).toBeVisible();
  });

  test("shows error for empty email", async ({ page }) => {
    await page.getByRole("button", { name: "Send Reset Link" }).click();
    await expect(page.getByRole("alert")).toContainText("enter your email");
  });

  test("shows error for non-northeastern email", async ({ page }) => {
    await page.getByRole("textbox", { name: "Email Address" }).fill("test@gmail.com");
    await page.getByRole("button", { name: "Send Reset Link" }).click();
    await expect(page.getByRole("alert")).toContainText("northeastern.edu");
  });

  test("shows success message after sending reset link", async ({ page }) => {
    await page.getByRole("textbox", { name: "Email Address" }).fill("test@northeastern.edu");
    await page.getByRole("button", { name: "Send Reset Link" }).click();
    await expect(page.getByText("Password reset email sent")).toBeVisible({ timeout: 10000 });
  });

  test("disables input and button after successful send", async ({ page }) => {
    await page.getByRole("textbox", { name: "Email Address" }).fill("test@northeastern.edu");
    await page.getByRole("button", { name: "Send Reset Link" }).click();
    await expect(page.getByRole("textbox", { name: "Email Address" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Email Sent!" })).toBeDisabled();
  });

  test("shows quarantine help text after successful send", async ({ page }) => {
    await page.getByRole("textbox", { name: "Email Address" }).fill("test@northeastern.edu");
    await page.getByRole("button", { name: "Send Reset Link" }).click();
    await expect(page.getByText("Junk/Spam")).toBeVisible();
    await expect(page.getByText("Microsoft 365 Quarantine")).toBeVisible();
  });

  test("shows error when reset request fails", async ({ page }) => {
    await mockSupabaseAuth(page, { resetError: "Rate limit exceeded" });
    await page.getByRole("textbox", { name: "Email Address" }).fill("test@northeastern.edu");
    await page.getByRole("button", { name: "Send Reset Link" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("back to sign in navigates to login", async ({ page }) => {
    await page.getByText("Back to Sign In").click();
    await expect(page).toHaveURL("/");
  });
});
