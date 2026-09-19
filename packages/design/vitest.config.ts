import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // theme.ts 读写 document.cookie / localStorage / <html>，需要一个真 DOM。
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
