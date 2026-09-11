import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "cd .. && npm run dev",
    port: 5173,
    // HAZARD: with this on, any other Vite project already listening on 5173
    // is used as-is, and the whole suite silently runs against the wrong app —
    // every selector fails for reasons that look like app bugs. If results make
    // no sense, check `lsof -nP -iTCP:5173 -sTCP:LISTEN` first.
    reuseExistingServer: true,
  },
  outputDir: "./test-results",
});
