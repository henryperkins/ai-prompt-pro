import { describe, expect, it } from "vitest";

import { createWebSocketHeartbeatState } from "../../agent_service/ws-helpers.mjs";

describe("websocket heartbeat state", () => {
  it("keeps waiting for pong across normal socket activity", () => {
    const state = createWebSocketHeartbeatState();

    state.markPingSent();
    state.onSocketActivity();

    expect(state.isAwaitingPong()).toBe(true);
  });

  it("clears the heartbeat wait only after pong arrives", () => {
    const state = createWebSocketHeartbeatState();

    state.markPingSent();
    state.onPong();

    expect(state.isAwaitingPong()).toBe(false);
  });
});
