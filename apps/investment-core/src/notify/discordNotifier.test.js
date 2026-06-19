import { describe, it, expect, vi } from "vitest";
import { createDiscordNotifier, formatDropMessage } from "./discordNotifier.js";

describe("createDiscordNotifier", () => {
  it("webhook 으로 메시지를 보낸다", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    const notify = createDiscordNotifier("https://discord.test/webhook", fetchImpl);
    const ok = await notify("hello");
    expect(ok).toBe(true);
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.content).toBe("hello");
  });

  it("webhook URL 없으면 조용히 false", async () => {
    const notify = createDiscordNotifier(undefined);
    expect(await notify("x")).toBe(false);
  });
});

describe("formatDropMessage", () => {
  it("종목·등락률·사유를 포함한다", () => {
    const msg = formatDropMessage({
      symbol: "005930",
      price: 70000,
      reasons: ["DAILY_DROP"],
      dailyChange: -0.045,
      intradayDrop: -0.06,
    });
    expect(msg).toContain("005930");
    expect(msg).toContain("-4.50%");
    expect(msg).toContain("DAILY_DROP");
  });
});
