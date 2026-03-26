import { useEffect, type FormEvent, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/base/dialog";
import { Button } from "@/components/base/buttons/button";
import { InputBase, Input } from "@/components/base/input/input";
import { InputGroup } from "@/components/base/input/input-group";
import { useAuth } from "@/hooks/useAuth";
import { fetchAuthCapabilities } from "@/lib/auth-api";
import { createPersistedAuthThrottle } from "@/lib/auth-throttle";
import { brandCopy } from "@/lib/brand-copy";
import { DISPLAY_NAME_MAX_LENGTH } from "@/lib/profile";
import { Eye, EyeSlash } from "@phosphor-icons/react";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const { signIn, signUp, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "forgot-password">("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusView, setStatusView] = useState<null | "signup-confirmation" | "reset-requested">(null);
  const [passwordResetEnabled, setPasswordResetEnabled] = useState(false);
  const [passwordResetSupportUrl, setPasswordResetSupportUrl] = useState("/contact");

  useEffect(() => {
    if (!open) return;

    let isMounted = true;

    void fetchAuthCapabilities()
      .then((capabilities) => {
        if (!isMounted) return;
        setPasswordResetEnabled(capabilities.passwordResetEnabled);
        setPasswordResetSupportUrl(capabilities.passwordResetSupportUrl || "/contact");
      })
      .catch(() => {
        if (!isMounted) return;
        setPasswordResetEnabled(false);
        setPasswordResetSupportUrl("/contact");
      });

    return () => {
      isMounted = false;
    };
  }, [open]);

  const formatCooldownError = (remainingCooldownMs: number) => {
    const remainingSeconds = Math.max(1, Math.ceil(remainingCooldownMs / 1000));
    return `Too many attempts. Try again in ${remainingSeconds}s.`;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    const normalizedEmail = email.trim();

    setError("");

    if (!normalizedEmail) {
      setError("Enter a valid email address.");
      return;
    }

    if (mode === "forgot-password") {
      setLoading(true);
      const result = await requestPasswordReset(normalizedEmail);
      setLoading(false);

      if (result.error) {
        setError(result.error);
        return;
      }

      setStatusView("reset-requested");
      return;
    }

    const loginThrottle =
      mode === "login"
        ? createPersistedAuthThrottle(normalizedEmail)
        : null;

    if (loginThrottle && !loginThrottle.canAttempt()) {
      setError(formatCooldownError(loginThrottle.remainingCooldownMs()));
      return;
    }

    setLoading(true);

    const result =
      mode === "login"
        ? await signIn(normalizedEmail, password)
        : await signUp(normalizedEmail, password, displayName);

    setLoading(false);

    if (result.error) {
      if (loginThrottle) {
        loginThrottle.recordFailure();
        const remainingCooldownMs = loginThrottle.remainingCooldownMs();
        if (remainingCooldownMs > 0) {
          setError(formatCooldownError(remainingCooldownMs));
          return;
        }
      }

      setError(result.error);
      return;
    }

    if (mode === "signup") {
      if (result.session) {
        onOpenChange(false);
        resetForm();
        return;
      }
      setStatusView("signup-confirmation");
      return;
    }

    loginThrottle?.recordSuccess();
    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setDisplayName("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setError("");
    setLoading(false);
    setStatusView(null);
  };

  const switchToMode = (nextMode: "login" | "signup" | "forgot-password") => {
    setMode(nextMode);
    setError("");
    setPassword("");
    setShowPassword(false);
    setStatusView(null);
  };

  const title = mode === "login"
    ? "Sign in"
    : mode === "signup"
      ? "Create account"
      : "Reset password";

  const description = mode === "forgot-password"
    ? "Enter your email and we’ll send a reset link if the account exists."
    : "Sign in or create an account to save, remix, and share prompts.";

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) resetForm();
      }}
    >
      <DialogContent className="pf-dialog-surface sm:max-w-md">
        <DialogHeader className="space-y-3">
          <div className="mx-auto inline-flex items-center rounded-md border border-border-primary bg-secondary px-2.5 py-1.5">
            <img
              src="/pf/promptforge-wordmark.png"
              alt=""
              decoding="async"
              className="h-7 w-auto object-contain"
              aria-hidden="true"
            />
          </div>
          <DialogTitle className="text-center">
            {title}
          </DialogTitle>
          <DialogDescription className="text-center text-xs text-tertiary">
            {description}
          </DialogDescription>
          <p className="text-center text-xs text-tertiary">
            {brandCopy.tagline}
          </p>
        </DialogHeader>

        {statusView ? (
          <div className="space-y-2 py-4 text-center">
            <p className="text-sm text-tertiary">
              {statusView === "signup-confirmation"
                ? "Check your email, confirm your account, then sign in."
                : "If an account exists for that email, we’ll send a password reset link."}
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                switchToMode("login");
              }}
            >
              Back to sign in
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-center text-xs text-tertiary">
              Email and password sign-in is currently the only available auth method.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "signup" && (
                <Input
                  label="Display name"
                  type="text"
                  value={displayName}
                  onChange={setDisplayName}
                  placeholder="Defaults to your email username"
                  autoComplete="name"
                  hint={`Max ${DISPLAY_NAME_MAX_LENGTH} visible characters. Hidden/control characters are not allowed.`}
                />
              )}

              <Input
                label="Email"
                isRequired
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                autoComplete="email"
              />

              {mode !== "forgot-password" ? (
                <>
                  <InputGroup
                    label="Password"
                    isRequired
                    value={password}
                    onChange={setPassword}
                    hint={mode === "signup" ? "Use at least 8 characters." : undefined}
                    trailingAddon={
                      <InputGroup.Prefix isDisabled={loading}>
                        <button
                          type="button"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          aria-pressed={showPassword}
                          className="inline-flex h-full items-center justify-center px-3 text-tertiary transition duration-100 ease-linear hover:text-secondary disabled:cursor-not-allowed disabled:text-disabled"
                          disabled={loading}
                          onClick={() => setShowPassword((isVisible) => !isVisible)}
                        >
                          {showPassword ? <EyeSlash className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                        </button>
                      </InputGroup.Prefix>
                    }
                  >
                    <InputBase
                      type={showPassword ? "text" : "password"}
                      placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"}
                      minLength={mode === "signup" ? 8 : undefined}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                    />
                  </InputGroup>

                  {mode === "login" && (
                    passwordResetEnabled ? (
                      <button
                        type="button"
                        className="text-sm text-brand-primary underline-offset-4 hover:underline"
                        onClick={() => switchToMode("forgot-password")}
                      >
                        Forgot password?
                      </button>
                    ) : (
                      <p className="text-sm text-tertiary">
                        Password reset is not self-serve in this environment.{" "}
                        <a
                          href={passwordResetSupportUrl}
                          className="text-brand-primary underline-offset-4 hover:underline"
                        >
                          Contact support
                        </a>
                        {" "}if you are locked out.
                      </p>
                    )
                  )}
                </>
              ) : null}

              {error && (
                <p className="text-sm text-error-primary">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                loading={loading}
              >
                {mode === "login"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset link"}
              </Button>
            </form>

            {mode === "forgot-password" ? (
              <p className="text-center text-sm text-tertiary">
                Remembered it?{" "}
                <button
                  type="button"
                  className="text-brand-primary underline-offset-4 hover:underline"
                  onClick={() => switchToMode("login")}
                >
                  Back to sign in
                </button>
              </p>
            ) : (
              <p className="text-center text-sm text-tertiary">
                {mode === "login" ? "No account? " : "Already have an account? "}
                <button
                  type="button"
                  className="text-brand-primary underline-offset-4 hover:underline"
                  onClick={() => switchToMode(mode === "login" ? "signup" : "login")}
                >
                  {mode === "login" ? "Sign up" : "Sign in"}
                </button>
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
