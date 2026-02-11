import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import History from "@/pages/History";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  toast: vi.fn(),
  queueRestoredVersionPrompt: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/usePromptBuilder", () => ({
  usePromptBuilder: () => ({
    versions: [
      {
        id: "v1",
        name: "Version 1",
        prompt: "Prompt body",
        timestamp: 1_720_000_000_000,
      },
    ],
  }),
}));

vi.mock("@/components/Header", () => ({
  Header: () => null,
}));

vi.mock("@/lib/history-restore", () => ({
  queueRestoredVersionPrompt: (prompt: string) => mocks.queueRestoredVersionPrompt(prompt),
}));

describe("History restore behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an error and does not navigate when restore queueing fails", () => {
    mocks.queueRestoredVersionPrompt.mockReturnValue(false);

    render(
      <ThemeProvider>
        <MemoryRouter>
          <History />
        </MemoryRouter>
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Restore" }));

    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Restore failed",
        variant: "destructive",
      }),
    );
  });

  it("navigates to builder when restore queueing succeeds", () => {
    mocks.queueRestoredVersionPrompt.mockReturnValue(true);

    render(
      <ThemeProvider>
        <MemoryRouter>
          <History />
        </MemoryRouter>
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Restore" }));

    expect(mocks.navigate).toHaveBeenCalledWith("/");
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Version ready",
      }),
    );
  });
});
