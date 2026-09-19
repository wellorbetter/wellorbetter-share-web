import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // routes.ts 是纯函数（worker 的 bundle 里也要能进），所以不需要 jsdom。
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
