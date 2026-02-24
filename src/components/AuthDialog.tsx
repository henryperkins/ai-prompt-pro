import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/base/dialog";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Label } from "@/components/base/label";
import { useAuth, type AuthOAuthProvider } from "@/hooks/useAuth";
import { brandCopy } from "@/lib/brand-copy";
import { SpinnerGap as Loader2 } from "@phosphor-icons/react";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const { signIn, signUp, signInWithOAuth } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result =
      mode === "login"
        ? await signIn(email, password)
        : await signUp(email, password);

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
    setError("");
    const result = await signInWithOAuth(provider);
    if (result.error) {
      setError(result.error);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setError("");
    setConfirmationSent(false);
  };

  const toggleMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setError("");
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
          <div className="mx-auto inline-flex items-center rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5">
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
          <DialogDescription className="text-center text-xs text-muted-foreground">
            Sign in or create an account to save, remix, and share prompts.
          </DialogDescription>
          <p className="text-center text-xs text-muted-foreground">
            {brandCopy.tagline}
          </p>
        </DialogHeader>

        {confirmationSent ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Check your email, confirm your account, then sign in.
            </p>
            <Button color="secondary" onClick={() => { setMode("login"); setConfirmationSent(false); }}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* OAuth buttons */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button color="secondary" onClick={() => handleOAuth("apple")}>
                <AppleIcon className="w-4 h-4 mr-2" />
                Apple
              </Button>
              <Button color="secondary" onClick={() => handleOAuth("github")}>
                <GitHubIcon className="w-4 h-4 mr-2" />
                GitHub
              </Button>
              <Button color="secondary" onClick={() => handleOAuth("google")}>
                <GoogleIcon className="w-4 h-4 mr-2" />
                Google
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with email
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="auth-email">Email</Label>
                <Input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {mode === "login" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              {mode === "login" ? "No account? " : "Already have an account? "}
              <button
                type="button"
                className="text-primary underline-offset-4 hover:underline"
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

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.41 2.155-1.23 3.045-.82.89-1.81 1.385-2.97 1.335-.02-.14-.03-.285-.03-.435 0-1.09.45-2.12 1.35-3.09.45-.5 1.02-.905 1.71-1.215.69-.31 1.34-.475 1.95-.495.14.285.21.57.21.855zm3.405 16.14c-.34.8-.75 1.55-1.23 2.25-.65.95-1.18 1.61-1.59 1.98-.63.61-1.305.925-2.025.945-.52 0-1.15-.15-1.89-.45-.74-.3-1.42-.45-2.04-.45-.65 0-1.35.15-2.1.45-.75.3-1.355.46-1.815.48-.69.03-1.38-.295-2.07-.975-.44-.39-.995-1.075-1.665-2.055-.72-1.04-1.31-2.245-1.77-3.615-.49-1.48-.735-2.915-.735-4.305 0-1.59.345-2.96 1.035-4.11.54-.92 1.26-1.645 2.16-2.175.9-.53 1.875-.8 2.925-.82.55 0 1.27.17 2.16.51.89.34 1.46.51 1.71.51.19 0 .84-.205 1.95-.615 1.05-.38 1.935-.54 2.655-.48 1.95.16 3.415.925 4.395 2.295-1.75 1.06-2.615 2.545-2.595 4.455.02 1.49.555 2.73 1.605 3.72.48.47 1.015.835 1.605 1.095-.13.37-.27.73-.42 1.08z" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
