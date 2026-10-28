import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const sourceRoot = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: { alias: { "@": sourceRoot } },
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/._*.test.ts", "**/node_modules/**", "**/node_modules.partial/**"],
  },
});
