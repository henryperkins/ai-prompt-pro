export function runGuardedAsync(handler, onError) {
  void Promise.resolve()
    .then(() => handler())
    .catch((error) => {
      onError(error);
    });
}
