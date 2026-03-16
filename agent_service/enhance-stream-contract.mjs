import { randomUUID } from "node:crypto";

function createSyntheticAgentMessageEvent({ turnId, threadId, text, itemId }) {
  const resolvedItemId = itemId || `item_enhanced_${randomUUID().replaceAll("-", "")}`;
  return {
    event: "item.completed",
    type: "item.completed",
    turn_id: turnId,
    thread_id: threadId,
    item_id: resolvedItemId,
    item_type: "agent_message",
    item: {
      id: resolvedItemId,
      type: "agent_message",
      text,
    },
  };
}

function createEnhanceMetadataEvent({
  turnId,
  threadId,
  payload,
  requestWarnings,
  session,
}) {
  return {
    event: "enhance/metadata",
    type: "enhance.metadata",
    turn_id: turnId,
    thread_id: threadId,
    payload,
    request_warnings: Array.isArray(requestWarnings) && requestWarnings.length > 0
      ? requestWarnings
      : undefined,
    session,
  };
}

function createEnhanceCompletionEvent({
  turnId,
  threadId,
  usage,
  session,
}) {
  return {
    event: "turn.completed",
    type: "response.completed",
    turn_id: turnId,
    thread_id: threadId,
    usage,
    response: {
      id: turnId,
      status: "completed",
    },
    session,
  };
}

export function buildEnhanceSuccessfulTerminalEvents({
  turnId,
  threadId,
  usage,
  payload,
  requestWarnings,
  session,
  emittedAgentOutput,
  finalEnhancedPrompt,
  syntheticItemId,
}) {
  const events = [];
  const normalizedPrompt =
    typeof finalEnhancedPrompt === "string"
      ? finalEnhancedPrompt.trim()
      : "";

  if (normalizedPrompt && !emittedAgentOutput) {
    events.push(createSyntheticAgentMessageEvent({
      turnId,
      threadId,
      text: normalizedPrompt,
      itemId: syntheticItemId,
    }));
  }

  events.push(createEnhanceMetadataEvent({
    turnId,
    threadId,
    payload,
    requestWarnings,
    session,
  }));
  events.push(createEnhanceCompletionEvent({
    turnId,
    threadId,
    usage,
    session,
  }));

  return events;
}
