export function createGitHubError(message, code = "github_error", status = 500) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

export function isGitHubError(error) {
  if (!error || typeof error !== "object") return false;
  const candidate = error;
  return (
    typeof candidate.message === "string"
    && (Number.isFinite(candidate.status) || typeof candidate.code === "string")
  );
}

