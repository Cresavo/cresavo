import { vi } from "vitest";

// In-process integration calls carry no signed client address, so they would all share one
// address budget (5 creates an hour). agent-address-limits.test.ts runs the real limiter.
vi.mock("../../src/lib/agent-api/address-limits", () => ({ checkAgentAddress: vi.fn(async () => {}) }));
