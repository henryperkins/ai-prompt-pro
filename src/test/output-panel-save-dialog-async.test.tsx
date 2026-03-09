import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OutputPanel } from "@/components/OutputPanel";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  trackBuilderEvent: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/lib/telemetry", () => ({
  trackBuilderEvent: (...args: unknown[]) => mocks.trackBuilderEvent(...args),
}));

function createDeferredResult() {
  let resolve!: (value: boolean) => void;
  const promise = new Promise<boolean>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function renderPanel(overrides?: Partial<Parameters<typeof OutputPanel>[0]>) {
  const onSavePrompt = vi.fn<Parameters<typeof OutputPanel>[0]["onSavePrompt"]>();
  const onSaveAndSharePrompt = vi.fn<Parameters<typeof OutputPanel>[0]["onSaveAndSharePrompt"]>();

  render(
    <OutputPanel
      builtPrompt="Draft launch plan"
      enhancedPrompt=""
      isEnhancing={false}
      onEnhance={() => undefined}
      onSaveVersion={() => undefined}
      onSavePrompt={onSavePrompt}
      onSaveAndSharePrompt={onSaveAndSharePrompt}
      canSavePrompt
      canSharePrompt
      {...overrides}
    />,
  );

  return { onSavePrompt, onSaveAndSharePrompt };
}

async function clickElement(element: Element) {
  await act(async () => {
    fireEvent.click(element);
  });
}

async function changeInput(element: Element, value: string) {
  await act(async () => {
    fireEvent.change(element, { target: { value } });
  });
}

async function openMenu(buttonName: "Save" | "More") {
  const trigger = screen.getByRole("button", { name: buttonName });
  await act(async () => {
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
  });
}

describe("OutputPanelSaveDialog async behavior", () => {
  it("closes dialog on successful save", async () => {
    const { onSavePrompt } = renderPanel();
    onSavePrompt.mockResolvedValue(true);

    await openMenu("Save");
    await clickElement(await screen.findByRole("menuitem", { name: "Save Prompt" }));

    expect(screen.getByLabelText("Prompt title")).toBeInTheDocument();

    await changeInput(screen.getByLabelText("Prompt title"), "My launch prompt");
    await clickElement(screen.getByRole("button", { name: "Save Prompt" }));

    await waitFor(() => {
      expect(screen.queryByLabelText("Prompt title")).not.toBeInTheDocument();
    });
    expect(onSavePrompt).toHaveBeenCalledTimes(1);
  });

  it("keeps dialog open when save fails", async () => {
    const { onSavePrompt } = renderPanel();
    onSavePrompt.mockResolvedValue(false);

    await openMenu("Save");
    await clickElement(await screen.findByRole("menuitem", { name: "Save Prompt" }));

    await changeInput(screen.getByLabelText("Prompt title"), "Failing prompt");
    await clickElement(screen.getByRole("button", { name: "Save Prompt" }));

    await waitFor(() => {
      expect(onSavePrompt).toHaveBeenCalledTimes(1);
    });
    // Dialog should remain open with values preserved
    expect(screen.getByLabelText("Prompt title")).toBeInTheDocument();
    expect(screen.getByLabelText("Prompt title")).toHaveValue("Failing prompt");
  });

  it("preserves title, use case, and remix note when save-and-share fails", async () => {
    const { onSaveAndSharePrompt } = renderPanel();
    onSaveAndSharePrompt.mockResolvedValue(false);

    await openMenu("Save");
    await clickElement(await screen.findByRole("menuitem", { name: "Save Prompt" }));

    await changeInput(screen.getByLabelText("Prompt title"), "My shared prompt");
    await clickElement(screen.getByRole("switch", { name: "Share to community" }));
    await changeInput(screen.getByLabelText("Use case"), "Team retro workflow");
    await clickElement(
      screen.getByLabelText("I confirm this prompt contains no secrets or private data."),
    );

    await clickElement(screen.getByRole("button", { name: "Save & Share" }));

    await waitFor(() => {
      expect(onSaveAndSharePrompt).toHaveBeenCalledTimes(1);
    });

    // Dialog should stay open with all values preserved
    expect(screen.getByLabelText("Prompt title")).toHaveValue("My shared prompt");
    expect(screen.getByLabelText("Use case")).toHaveValue("Team retro workflow");
  });

  it("disables submit button while save is pending and prevents duplicate calls", async () => {
    const deferred = createDeferredResult();
    const { onSavePrompt } = renderPanel();
    onSavePrompt.mockReturnValue(deferred.promise);

    await openMenu("Save");
    await clickElement(await screen.findByRole("menuitem", { name: "Save Prompt" }));
    await changeInput(screen.getByLabelText("Prompt title"), "Pending prompt");

    await clickElement(screen.getByRole("button", { name: "Save Prompt" }));

    // Button should be disabled and show "Saving…"
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    });

    // Second click should be ignored
    await clickElement(screen.getByRole("button", { name: "Saving…" }));
    expect(onSavePrompt).toHaveBeenCalledTimes(1);

    // Resolve the pending save
    await act(async () => {
      deferred.resolve(true);
    });

    // Dialog should close after resolution
    await waitFor(() => {
      expect(screen.queryByLabelText("Prompt title")).not.toBeInTheDocument();
    });
  });

  it("re-enables submit button after a failed save", async () => {
    const deferred = createDeferredResult();
    const { onSavePrompt } = renderPanel();
    onSavePrompt.mockReturnValue(deferred.promise);

    await openMenu("Save");
    await clickElement(await screen.findByRole("menuitem", { name: "Save Prompt" }));
    await changeInput(screen.getByLabelText("Prompt title"), "Retry prompt");

    await clickElement(screen.getByRole("button", { name: "Save Prompt" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    });

    // Resolve with failure
    await act(async () => {
      deferred.resolve(false);
    });

    // Button should re-enable
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save Prompt" })).not.toBeDisabled();
    });

    // Dialog stays open
    expect(screen.getByLabelText("Prompt title")).toHaveValue("Retry prompt");
  });
});
