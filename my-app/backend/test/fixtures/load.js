// Loader for the synthetic Vision fixtures in test/fixtures/vision/.
// Each file is a complete images:annotate response; the detector consumes
// responses[0], so that is what this returns.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function loadVision(name) {
  const path = fileURLToPath(new URL(`./vision/${name}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")).responses[0];
}
