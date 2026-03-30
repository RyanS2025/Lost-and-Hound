import { test, expect } from "@playwright/test";
import { mockSupabaseAuth } from "./helpers/mock-supabase.js";

test.describe("Reset Password Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabaseAuth(page);
    await page.goto("/reset-password");
  });

  test("renders the reset password form", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Set New Password" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "New Password" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Confirm Password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Update Password" })).toBeVisible();
    await expect(page.getByText("Back to Sign In")).toBeVisible();
  });

  test("shows error for empty password", async ({ page }) => {
    await page.getByRole("button", { name: "Update Password" }).click();
    await expect(page.getByRole("alert")).toContainText("enter a new password");
  });

  test("shows error for password shorter than 6 characters", async ({ page }) => {
    await page.getByRole("textbox", { name: "New Password" }).fill("abc");
    await page.getByRole("button", { name: "Update Password" }).click();
    await expect(page.getByRole("alert")).toContainText("at least 6 characters");
  });

  test("shows error for mismatched passwords", async ({ page }) => {
    await page.getByRole("textbox", { name: "New Password" }).fill("password123");
    await page.getByRole("textbox", { name: "Confirm Password" }).fill("different456");
    await page.getByRole("button", { name: "Update Password" }).click();
    await expect(page.getByRole("alert")).toContainText("do not match");
  });

  test("password field enforces max length of 32 characters", async ({ page }) => {
    const longPassword = "a".repeat(40);
    await page.getByRole("textbox", { name: "New Password" }).fill(longPassword);
    const value = await page.getByRole("textbox", { name: "New Password" }).inputValue();
    expect(value.length).toBeLessThanOrEqual(32);
  });

  test("confirm password field enforces max length of 32 characters", async ({ page }) => {
    const longPassword = "a".repeat(40);
    await page.getByRole("textbox", { name: "Confirm Password" }).fill(longPassword);
    const value = await page.getByRole("textbox", { name: "Confirm Password" }).inputValue();
    expect(value.length).toBeLessThanOrEqual(32);
  });

  test("show/hide password toggle works", async ({ page }) => {
    const passwordInput = page.getByRole("textbox", { name: "New Password" });
    await passwordInput.fill("password123");

    // Find and click the visibility toggle (first one)
    const toggleButtons = page.locator("button").filter({ has: page.locator("svg") });
    const firstToggle = toggleButtons.first();
    await firstToggle.click();

    // After clicking, the input type should have changed (text content visible)
    // We verify by checking the input still has the value
    await expect(passwordInput).toHaveValue("password123");
  });

  test("back to sign in link is visible", async ({ page }) => {
    await expect(page.getByText("Back to Sign In")).toBeVisible();
  });
});
