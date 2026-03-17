import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthDialog } from "@/components/AuthDialog";

const mocks = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  signIn: vi.fn(),
  signInWithOAuth: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    signIn: (...args: unknown[]) => mocks.signIn(...args),
    signUp: (...args: unknown[]) => mocks.signUp(...args),
    signInWithOAuth: (...args: unknown[]) => mocks.signInWithOAuth(...args),
  }),
}));

vi.mock("@/integrations/neon/client", () => ({
  neon: {
    auth: {
      resetPasswordForEmail: (...args: unknown[]) => mocks.resetPasswordForEmail(...args),
    },
  },
}));

function StatefulDialogHarness() {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Reopen dialog
      </button>
      <AuthDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

async function fillEmailPassword(email = "user@example.com", password = "Passw0rd!") {
  await act(async () => {
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: email } });
    fireEvent.change(screen.getByPlaceholderText("Enter your password"), { target: { value: password } });
  });
}

async function fillSignUpFields({
  displayName = "",
  email = "user@example.com",
  password = "Passw0rd!",
} = {}) {
  await act(async () => {
    fireEvent.change(screen.getByPlaceholderText("Defaults to your email username"), { target: { value: displayName } });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: email } });
    fireEvent.change(screen.getByPlaceholderText("At least 8 characters"), { target: { value: password } });
  });
}

async function submit(buttonName: "Sign in" | "Create account") {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: buttonName }));
  });
}

async function switchMode(buttonName: "Sign up" | "Sign in") {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: buttonName }));
  });
}

describe("AuthDialog login throttle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-17T00:00:00.000Z"));
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mocks.signIn.mockResolvedValue({
      error: "Invalid login credentials.",
      session: null,
      user: null,
    });
    mocks.signUp.mockResolvedValue({
      error: "Sign up failed.",
      session: null,
      user: null,
    });
    mocks.signInWithOAuth.mockResolvedValue({
      error: null,
      session: null,
    });
    mocks.resetPasswordForEmail.mockResolvedValue({
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a cooldown error and stops calling signIn after repeated login failures", async () => {
    render(<AuthDialog open onOpenChange={vi.fn()} />);
    await fillEmailPassword();

    await submit("Sign in");
    await submit("Sign in");
    await submit("Sign in");
    await submit("Sign in");

    expect(mocks.signIn).toHaveBeenCalledTimes(3);
    expect(screen.getByText("Too many attempts. Try again in 30s.")).toBeInTheDocument();
  });

  it("does not let failed signup attempts trip the login throttle", async () => {
    render(<AuthDialog open onOpenChange={vi.fn()} />);

    await switchMode("Sign up");
    await fillSignUpFields({ email: "signup@example.com", password: "Passw0rd!" });

    await submit("Create account");
    await submit("Create account");
    await submit("Create account");
    await submit("Create account");

    expect(mocks.signUp).toHaveBeenCalledTimes(4);
    expect(screen.queryByText(/Too many attempts\./)).not.toBeInTheDocument();

    await switchMode("Sign in");
    await fillEmailPassword("signup@example.com", "Passw0rd!");
    await submit("Sign in");

    expect(mocks.signIn).toHaveBeenCalledTimes(1);
  });

  it("resets the throttle after a successful login", async () => {
    mocks.signIn
      .mockResolvedValueOnce({
        error: "Invalid login credentials.",
        session: null,
        user: null,
      })
      .mockResolvedValueOnce({
        error: "Invalid login credentials.",
        session: null,
        user: null,
      })
      .mockResolvedValueOnce({
        error: null,
        session: { access_token: "token" },
        user: { id: "user-1" },
      })
      .mockResolvedValue({
        error: "Invalid login credentials.",
        session: null,
        user: null,
      });

    render(<AuthDialog open onOpenChange={vi.fn()} />);
    await fillEmailPassword();

    await submit("Sign in");
    await submit("Sign in");
    await submit("Sign in");

    expect(screen.getByPlaceholderText("you@example.com")).toHaveValue("");
    expect(screen.getByPlaceholderText("Enter your password")).toHaveValue("");

    await fillEmailPassword("second@example.com", "Passw0rd!");
    await submit("Sign in");
    await submit("Sign in");
    await submit("Sign in");
    await submit("Sign in");

    expect(mocks.signIn).toHaveBeenCalledTimes(6);
    expect(screen.getByText("Too many attempts. Try again in 30s.")).toBeInTheDocument();
  });

  it("keeps the throttle active for the same email when the dialog closes and reopens", async () => {
    render(<StatefulDialogHarness />);
    await fillEmailPassword();

    await submit("Sign in");
    await submit("Sign in");
    await submit("Sign in");
    await submit("Sign in");

    expect(mocks.signIn).toHaveBeenCalledTimes(3);
    expect(screen.getByText("Too many attempts. Try again in 30s.")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      vi.runAllTimers();
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reopen dialog" }));
    });

    await fillEmailPassword("user@example.com", "Passw0rd!");
    await submit("Sign in");

    expect(mocks.signIn).toHaveBeenCalledTimes(3);
    expect(screen.getByText("Too many attempts. Try again in 30s.")).toBeInTheDocument();

    await fillEmailPassword("different@example.com", "Passw0rd!");
    await submit("Sign in");

    expect(mocks.signIn).toHaveBeenCalledTimes(4);
  });
});
