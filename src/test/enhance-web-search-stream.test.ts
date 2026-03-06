import { describe, it, expect } from "vitest";
import {
  extractWebSearchActivity,
  IDLE_WEB_SEARCH_ACTIVITY,
} from "@/lib/enhance-web-search-stream";

describe("extractWebSearchActivity", () => {
  it("returns null for non-web-search item types", () => {
    expect(
      extractWebSearchActivity(IDLE_WEB_SEARCH_ACTIVITY, {
        eventType: "item.started",
        responseType: "response.output_item.added",
        itemId: "item_1",
        itemType: "agent_message",
      }, {}),
    ).toBeNull();
  });

  it("detects web_search_call item.started as searching", () => {
    const result = extractWebSearchActivity(IDLE_WEB_SEARCH_ACTIVITY, {
      eventType: "item.started",
      responseType: "response.output_item.added",
      itemId: "item_ws_1",
      itemType: "web_search_call",
    }, {
      web_search_activity: { phase: "searching", query: "react hooks best practices" },
    });

    expect(result).toEqual({
      phase: "searching",
      query: "react hooks best practices",
      itemId: "item_ws_1",
      searchCount: 1,
    });
  });

  it("detects web_search item type without backend envelope", () => {
    const result = extractWebSearchActivity(IDLE_WEB_SEARCH_ACTIVITY, {
      eventType: "item.started",
      responseType: "response.output_item.added",
      itemId: "item_ws_2",
      itemType: "web_search",
    }, {
      item: { id: "item_ws_2", type: "web_search", arguments: '{"query":"tailwind v4 migration"}' },
    });

    expect(result).not.toBeNull();
    expect(result!.phase).toBe("searching");
    expect(result!.query).toBe("tailwind v4 migration");
    expect(result!.searchCount).toBe(1);
  });

  it("detects item.completed as completed phase", () => {
    const previous = {
      phase: "searching" as const,
      query: "react hooks",
      itemId: "item_ws_1",
      searchCount: 1,
    };
    const result = extractWebSearchActivity(previous, {
      eventType: "item.completed",
      responseType: "response.output_item.done",
      itemId: "item_ws_1",
      itemType: "web_search_call",
    }, {
      web_search_activity: { phase: "completed", query: "react hooks" },
    });

    expect(result).toEqual({
      phase: "completed",
      query: "react hooks",
      itemId: "item_ws_1",
      searchCount: 1,
    });
  });

  it("increments searchCount for new item IDs", () => {
    const previous = {
      phase: "completed" as const,
      query: "first query",
      itemId: "item_ws_1",
      searchCount: 1,
    };
    const result = extractWebSearchActivity(previous, {
      eventType: "item.started",
      responseType: "response.output_item.added",
      itemId: "item_ws_2",
      itemType: "web_search_call",
    }, {
      web_search_activity: { phase: "searching", query: "second query" },
    });

    expect(result!.searchCount).toBe(2);
    expect(result!.query).toBe("second query");
    expect(result!.itemId).toBe("item_ws_2");
  });

  it("does not increment searchCount for same item ID", () => {
    const previous = {
      phase: "searching" as const,
      query: "same query",
      itemId: "item_ws_1",
      searchCount: 1,
    };
    const result = extractWebSearchActivity(previous, {
      eventType: "item.updated",
      responseType: "response.output_item.updated",
      itemId: "item_ws_1",
      itemType: "web_search_call",
    }, {
      web_search_activity: { phase: "searching", query: "same query" },
    });

    expect(result!.searchCount).toBe(1);
  });

  it("falls back to previous query when none in payload", () => {
    const previous = {
      phase: "searching" as const,
      query: "previous query",
      itemId: "item_ws_1",
      searchCount: 1,
    };
    const result = extractWebSearchActivity(previous, {
      eventType: "item.completed",
      responseType: "response.output_item.done",
      itemId: "item_ws_1",
      itemType: "web_search_call",
    }, {});

    expect(result!.query).toBe("previous query");
  });

  it("returns null for reasoning item types", () => {
    expect(
      extractWebSearchActivity(IDLE_WEB_SEARCH_ACTIVITY, {
        eventType: "item/reasoning/delta",
        responseType: "response.reasoning_summary_text.delta",
        itemId: "item_r_1",
        itemType: "reasoning",
      }, {}),
    ).toBeNull();
  });

  it("returns null for file_search_call (not a web search tool)", () => {
    expect(
      extractWebSearchActivity(IDLE_WEB_SEARCH_ACTIVITY, {
        eventType: "item.started",
        responseType: "response.output_item.added",
        itemId: "item_fs_1",
        itemType: "file_search_call",
      }, {}),
    ).toBeNull();
  });

  it("returns null for code_search_call (not a web search tool)", () => {
    expect(
      extractWebSearchActivity(IDLE_WEB_SEARCH_ACTIVITY, {
        eventType: "item.started",
        responseType: "response.output_item.added",
        itemId: "item_cs_1",
        itemType: "code_search_call",
      }, {}),
    ).toBeNull();
  });

  it("still matches web_search_call variants with separators", () => {
    const result = extractWebSearchActivity(IDLE_WEB_SEARCH_ACTIVITY, {
      eventType: "item.started",
      responseType: "response.output_item.added",
      itemId: "item_wsc_1",
      itemType: "web-search-call",
    }, {});

    expect(result).not.toBeNull();
    expect(result!.phase).toBe("searching");
  });
});
