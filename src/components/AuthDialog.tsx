import { type FormEvent, useState } from "react";
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
import { AppleOAuthIcon, GitHubOAuthIcon, GoogleOAuthIcon } from "@/components/icons/oauth-icons";
import { useAuth, type AuthOAuthProvider } from "@/hooks/useAuth";
import { neon } from "@/integrations/neon/client";
import { brandCopy } from "@/lib/brand-copy";
import { Eye, EyeSlash } from "@phosphor-icons/react";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const { signIn, signUp, signInWithOAuth } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<AuthOAuthProvider | null>(null);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || oauthLoading || forgotPasswordLoading) return;

    const normalizedEmail = email.trim();

    setError("");
    setForgotPasswordSent(false);

    if (!normalizedEmail) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);

    const result =
      mode === "login"
        ? await signIn(normalizedEmail, password)
        : await signUp(normalizedEmail, password, displayName);

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (mode === "signup") {
      if (result.session) {
        onOpenChange(false);
        resetForm();
        return;
      }
      setConfirmationSent(true);
      return;
    }

    // Login succeeded — close
    onOpenChange(false);
    resetForm();
  };

  const handleOAuth = async (provider: AuthOAuthProvider) => {
    if (loading || oauthLoading) return;

    setError("");
    setForgotPasswordSent(false);
    setOauthLoading(provider);

    try {
      const result = await signInWithOAuth(provider);
      if (result.error) {
        setError(result.error);
      }
    } finally {
      setOauthLoading(null);
    }
  };

  const handleForgotPassword = async () => {
    if (loading || oauthLoading || forgotPasswordLoading) return;

    const normalizedEmail = email.trim();
    setError("");
    setForgotPasswordSent(false);

    if (!normalizedEmail) {
      setError("Enter your email first to reset your password.");
      return;
    }

    setForgotPasswordLoading(true);
    try {
      const { error: forgotPasswordError } = await neon.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo: window.location.origin },
      );

      if (forgotPasswordError) {
        setError(forgotPasswordError.message || "Failed to send reset email.");
        return;
      }

      setForgotPasswordSent(true);
    } catch (forgotPasswordError) {
      setError(forgotPasswordError instanceof Error ? forgotPasswordError.message : "Failed to send reset email.");
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const resetForm = () => {
    setDisplayName("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setError("");
    setLoading(false);
    setOauthLoading(null);
    setForgotPasswordLoading(false);
    setForgotPasswordSent(false);
    setConfirmationSent(false);
  };

  const toggleMode = () => {
    setMode((currentMode) => (currentMode === "login" ? "signup" : "login"));
    setError("");
    setPassword("");
    setShowPassword(false);
    setForgotPasswordLoading(false);
    setForgotPasswordSent(false);
    setConfirmationSent(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
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
            {mode === "login" ? "Sign in" : "Create account"}
          </DialogTitle>
          <DialogDescription className="text-center text-xs text-tertiary">
            Sign in or create an account to save, remix, and share prompts.
          </DialogDescription>
          <p className="text-center text-xs text-tertiary">
            {brandCopy.tagline}
          </p>
        </DialogHeader>

        {confirmationSent ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-sm text-tertiary">
              Check your email, confirm your account, then sign in.
            </p>
            <Button
              color="secondary"
              onClick={() => {
                setMode("login");
                setConfirmationSent(false);
              }}
            >
              Back to sign in
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* OAuth buttons */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button
                color="secondary"
                onClick={() => void handleOAuth("apple")}
                isDisabled={loading || Boolean(oauthLoading)}
                isLoading={oauthLoading === "apple"}
                showTextWhileLoading
                iconLeading={AppleOAuthIcon}
              >
                Apple
              </Button>
              <Button
                color="secondary"
                onClick={() => void handleOAuth("github")}
                isDisabled={loading || Boolean(oauthLoading)}
                isLoading={oauthLoading === "github"}
                showTextWhileLoading
                iconLeading={GitHubOAuthIcon}
              >
                GitHub
              </Button>
              <Button
                color="secondary"
                onClick={() => void handleOAuth("google")}
                isDisabled={loading || Boolean(oauthLoading)}
                isLoading={oauthLoading === "google"}
                showTextWhileLoading
                iconLeading={GoogleOAuthIcon}
              >
                Google
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-secondary px-2 text-tertiary">
                  Or continue with email
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "signup" && (
                <Input
                  label="Display name"
                  type="text"
                  value={displayName}
                  onChange={setDisplayName}
                  placeholder="Defaults to your email username"
                  autoComplete="name"
                  maxLength={80}
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

              <InputGroup
                label="Password"
                isRequired
                value={password}
                onChange={setPassword}
                hint={mode === "signup" ? "Use at least 8 characters." : undefined}
                trailingAddon={
                  <InputGroup.Prefix isDisabled={loading || Boolean(oauthLoading)}>
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      className="inline-flex h-full items-center justify-center px-3 text-tertiary transition duration-100 ease-linear hover:text-secondary disabled:cursor-not-allowed disabled:text-disabled"
                      disabled={loading || Boolean(oauthLoading)}
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
                <div className="flex justify-end">
                  <Button
                    type="button"
                    color="link-color"
                    onClick={() => void handleForgotPassword()}
                    isDisabled={loading || Boolean(oauthLoading) || forgotPasswordLoading}
                    isLoading={forgotPasswordLoading}
                    showTextWhileLoading
                    className="text-sm"
                  >
                    Forgot password?
                  </Button>
                </div>
              )}

              {forgotPasswordSent && mode === "login" && (
                <p className="text-sm text-tertiary">
                  Password reset email sent. Check your inbox.
                </p>
              )}

              {error && (
                <p className="text-sm text-error-primary">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                isDisabled={loading || Boolean(oauthLoading)}
                isLoading={loading}
              >
                {mode === "login" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <p className="text-center text-sm text-tertiary">
              {mode === "login" ? "No account? " : "Already have an account? "}
              <button
                type="button"
                className="text-brand-primary underline-offset-4 hover:underline"
                onClick={toggleMode}
              >
                {mode === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
