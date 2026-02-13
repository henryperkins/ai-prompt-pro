import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/integrations/neon/client", () => ({
  neon: {
    auth: {
      getSession: (...args: unknown[]) => mocks.getSession(...args),
      onAuthStateChange: (...args: unknown[]) => mocks.onAuthStateChange(...args),
      signUp: (...args: unknown[]) => mocks.signUp(...args),
      signInWithPassword: (...args: unknown[]) => mocks.signInWithPassword(...args),
      signInWithOAuth: (...args: unknown[]) => mocks.signInWithOAuth(...args),
      signOut: (...args: unknown[]) => mocks.signOut(...args),
      updateUser: (...args: unknown[]) => mocks.updateUser(...args),
    },
    from: (...args: unknown[]) => mocks.from(...args),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("useAuth signUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mocks.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    });
    mocks.signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });
  });

  it("sends a non-empty name derived from email when display name is missing", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.signUp("jane.doe@example.com", "Passw0rd!");

    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "jane.doe@example.com",
      password: "Passw0rd!",
      options: {
        data: {
          displayName: "jane.doe",
          name: "jane.doe",
        },
      },
    });
  });

  it("prefers provided display name when signing up", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.signUp("jane.doe@example.com", "Passw0rd!", "  Jane Doe  ");

    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "jane.doe@example.com",
      password: "Passw0rd!",
      options: {
        data: {
          displayName: "Jane Doe",
          name: "Jane Doe",
        },
      },
    });
  });
});
