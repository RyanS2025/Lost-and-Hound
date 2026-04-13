import { test, expect } from "@playwright/test";
import { mockSupabaseAuth } from "./helpers/mock-supabase.js";

test.describe("Signup Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabaseAuth(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Sign Up" }).click();
  });

  test("renders the signup form", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "First Name" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Last Name" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  });

  test("shows error when first name is empty", async ({ page }) => {
    await page.getByRole("textbox", { name: "Last Name" }).fill("Patel");
    await page.getByRole("textbox", { name: "Email" }).fill("test@northeastern.edu");
    await page.getByRole("textbox", { name: "Password" }).fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("shows error when last name is empty", async ({ page }) => {
    await page.getByRole("textbox", { name: "First Name" }).fill("Krish");
    await page.getByRole("textbox", { name: "Email" }).fill("test@northeastern.edu");
    await page.getByRole("textbox", { name: "Password" }).fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("shows error for non-northeastern email", async ({ page }) => {
    await page.getByRole("textbox", { name: "First Name" }).fill("Krish");
    await page.getByRole("textbox", { name: "Last Name" }).fill("Patel");
    await page.getByRole("textbox", { name: "Email" }).fill("test@gmail.com");
    await page.getByRole("textbox", { name: "Password" }).fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("alert")).toContainText("northeastern.edu");
  });

  test("shows error for password shorter than 6 characters", async ({ page }) => {
    await page.getByRole("textbox", { name: "First Name" }).fill("Krish");
    await page.getByRole("textbox", { name: "Last Name" }).fill("Patel");
    await page.getByRole("textbox", { name: "Email" }).fill("test@northeastern.edu");
    await page.getByRole("textbox", { name: "Password" }).fill("abc");
    await page.getByRole("button", { name: "Create account" }).click();
    // Password validation happens after terms acceptance, so accept terms first
    await expect(page.getByRole("heading", { name: "Terms & Conditions" })).toBeVisible();
    // Scroll terms to the bottom
    await page.getByText("13. Governing Law").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.getByText("13. Governing Law").hover();
    await page.mouse.wheel(0, 5000);
    await page.waitForTimeout(500);
    await page.getByRole("checkbox", { name: /Terms & Conditions/ }).click();
    await page.getByRole("button", { name: "Accept & Create Account" }).click();
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
  });

  test("shows terms modal before creating account", async ({ page }) => {
    await page.getByRole("textbox", { name: "First Name" }).fill("Krish");
    await page.getByRole("textbox", { name: "Last Name" }).fill("Patel");
    await page.getByRole("textbox", { name: "Email" }).fill("test@northeastern.edu");
    await page.getByRole("textbox", { name: "Password" }).fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "Terms & Conditions" })).toBeVisible();
    await expect(page.getByText("Accept & Create Account")).toBeVisible();
  });

  test("terms checkbox is disabled until scrolled to bottom", async ({ page }) => {
    await page.getByRole("textbox", { name: "First Name" }).fill("Krish");
    await page.getByRole("textbox", { name: "Last Name" }).fill("Patel");
    await page.getByRole("textbox", { name: "Email" }).fill("test@northeastern.edu");
    await page.getByRole("textbox", { name: "Password" }).fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "Terms & Conditions" })).toBeVisible();
    const checkbox = page.getByRole("checkbox", { name: /Terms & Conditions/ });
    await expect(checkbox).toBeDisabled();
  });

  test("successful signup shows confirmation message", async ({ page }) => {
    await page.getByRole("textbox", { name: "First Name" }).fill("Krish");
    await page.getByRole("textbox", { name: "Last Name" }).fill("Patel");
    await page.getByRole("textbox", { name: "Email" }).fill("test@northeastern.edu");
    await page.getByRole("textbox", { name: "Password" }).fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();

    // Scroll terms to bottom and accept
    // Scroll the terms to the bottom by clicking the last section to focus it
    await page.getByText("13. Governing Law").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    // Trigger the scroll handler by scrolling via mouse wheel on the dialog
    await page.getByText("13. Governing Law").hover();
    await page.mouse.wheel(0, 5000);
    await page.waitForTimeout(500);
    await page.getByRole("checkbox", { name: /Terms & Conditions/ }).click();
    await page.getByRole("button", { name: "Accept & Create Account" }).click();

    await expect(page.getByText("Account created!")).toBeVisible();
    await expect(page.getByText("verification link")).toBeVisible();
  });

  test("shows error for existing account", async ({ page }) => {
    await mockSupabaseAuth(page, { signupExistingUser: true });
    await page.getByRole("textbox", { name: "First Name" }).fill("Krish");
    await page.getByRole("textbox", { name: "Last Name" }).fill("Patel");
    await page.getByRole("textbox", { name: "Email" }).fill("existing@northeastern.edu");
    await page.getByRole("textbox", { name: "Password" }).fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();

    // Scroll terms to bottom and accept
    // Scroll the terms to the bottom by clicking the last section to focus it
    await page.getByText("13. Governing Law").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    // Trigger the scroll handler by scrolling via mouse wheel on the dialog
    await page.getByText("13. Governing Law").hover();
    await page.mouse.wheel(0, 5000);
    await page.waitForTimeout(500);
    await page.getByRole("checkbox", { name: /Terms & Conditions/ }).click();
    await page.getByRole("button", { name: "Accept & Create Account" }).click();

    await expect(page.getByText("already exists")).toBeVisible();
  });

  test("name fields enforce max length of 25 characters", async ({ page }) => {
    const longName = "a".repeat(30);
    await page.getByRole("textbox", { name: "First Name" }).fill(longName);
    const value = await page.getByRole("textbox", { name: "First Name" }).inputValue();
    expect(value.length).toBeLessThanOrEqual(25);
  });

  test("log in link switches back to login form", async ({ page }) => {
    await page.getByRole("button", { name: "Log In" }).click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });
});
