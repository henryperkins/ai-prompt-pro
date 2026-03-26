import { type FormEvent, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { PageHero, PageShell } from "@/components/PageShell";
import { Button } from "@/components/base/buttons/button";
import { InputBase } from "@/components/base/input/input";
import { InputGroup } from "@/components/base/input/input-group";
import { useToast } from "@/hooks/use-toast";
import { apiConfirmPasswordReset } from "@/lib/auth-api";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const token = searchParams.get("token")?.trim() || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [didReset, setDidReset] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setError("");

    if (!token) {
      setError("This password reset link is missing its token.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await apiConfirmPasswordReset(token, password);
      setDidReset(true);
      toast({
        title: "Password updated",
        description: "Sign in with your new password.",
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Password reset failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell mainClassName="mx-auto flex w-full max-w-2xl items-center py-8 sm:py-12">
      <section className="w-full space-y-6">
        <PageHero
          pattern="utility"
          title="Reset password"
          subtitle="Choose a new password for your PromptForge account."
        />

        <div className="pf-gilded-frame bg-card/80 p-5 shadow-sm sm:p-6">
          {didReset ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-tertiary">
                Your password has been reset. Return to the app and sign in with your new password.
              </p>
              <Button className="w-full sm:w-auto" onClick={() => navigate("/")}>
                Return Home
              </Button>
            </div>
          ) : token ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <InputGroup
                label="New password"
                isRequired
                value={password}
                onChange={setPassword}
                hint="Use at least 8 characters."
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
                  placeholder="At least 8 characters"
                  minLength={8}
                  autoComplete="new-password"
                />
              </InputGroup>

              <InputGroup
                label="Confirm password"
                isRequired
                value={confirmPassword}
                onChange={setConfirmPassword}
              >
                <InputBase
                  type={showPassword ? "text" : "password"}
                  placeholder="Repeat your new password"
                  minLength={8}
                  autoComplete="new-password"
                />
              </InputGroup>

              {error ? <p className="text-sm text-error-primary">{error}</p> : null}

              <Button type="submit" className="w-full" disabled={loading} loading={loading}>
                Save new password
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-sm text-tertiary">
                This reset link is incomplete. Request a fresh link from the sign-in dialog or contact support.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button variant="secondary" onClick={() => navigate("/")}>
                  Return Home
                </Button>
                <Button variant="link" tone="brand" onClick={() => navigate("/contact")}>
                  Contact support
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
};

export default ResetPassword;
