import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [cloudflareTest(async () => ({
    wrangler: { configPath: "./wrangler.jsonc" },
    miniflare: {
      d1Databases: ["DB"],
      bindings: {
        TEST_MIGRATIONS: await readD1Migrations("migrations"),
        TELEGRAM_WEBHOOK_SECRET: "test-webhook-secret",
        ALLOWED_TELEGRAM_USER_ID: "123456789",
        TELEGRAM_BOT_TOKEN: "test-bot-token",
        DASHBOARD_USERNAME: "test-user",
        DASHBOARD_PASSWORD: "test-password"
      }
    }
  }))]
});
