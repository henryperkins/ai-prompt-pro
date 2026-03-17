export interface AuthThrottleOptions {
  threshold?: number;
  cooldownMs?: number;
  now?: () => number;
  initialState?: Partial<AuthThrottleState> | null;
  onStateChange?: (state: AuthThrottleState) => void;
}

export interface AuthThrottle {
  canAttempt: () => boolean;
  recordFailure: () => void;
  recordSuccess: () => void;
  remainingCooldownMs: () => number;
}

export interface AuthThrottleState {
  failureCount: number;
  cooldownUntil: number;
}

const DEFAULT_THRESHOLD = 3;
const DEFAULT_COOLDOWN_MS = 30_000;
const AUTH_THROTTLE_SESSION_STORAGE_KEY = "promptforge:auth-throttle:v1";
const memoryThrottleState = new Map<string, AuthThrottleState>();

function cloneState(state: AuthThrottleState): AuthThrottleState {
  return {
    failureCount: state.failureCount,
    cooldownUntil: state.cooldownUntil,
  };
}

function normalizeThrottleState(state?: Partial<AuthThrottleState> | null): AuthThrottleState {
  const failureCount = Number.isFinite(state?.failureCount)
    ? Math.max(0, Math.floor(state?.failureCount ?? 0))
    : 0;
  const cooldownUntil = Number.isFinite(state?.cooldownUntil)
    ? Math.max(0, Math.floor(state?.cooldownUntil ?? 0))
    : 0;

  return {
    failureCount,
    cooldownUntil,
  };
}

function normalizeThrottleIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

function canUseSessionStorage(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
  } catch {
    return false;
  }
}

function readPersistedAuthThrottleRecord(): Record<string, AuthThrottleState> {
  if (!canUseSessionStorage()) {
    return Object.fromEntries(
      Array.from(memoryThrottleState.entries()).map(([key, value]) => [key, cloneState(value)]),
    );
  }

  try {
    const raw = window.sessionStorage.getItem(AUTH_THROTTLE_SESSION_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, Partial<AuthThrottleState>> | null;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [normalizeThrottleIdentifier(key), normalizeThrottleState(value)])
        .filter(([key]) => key.length > 0),
    );
  } catch {
    return {};
  }
}

function writePersistedAuthThrottleRecord(record: Record<string, AuthThrottleState>): void {
  if (!canUseSessionStorage()) {
    memoryThrottleState.clear();
    Object.entries(record).forEach(([key, value]) => {
      memoryThrottleState.set(key, cloneState(value));
    });
    return;
  }

  try {
    const keys = Object.keys(record);
    if (keys.length === 0) {
      window.sessionStorage.removeItem(AUTH_THROTTLE_SESSION_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(AUTH_THROTTLE_SESSION_STORAGE_KEY, JSON.stringify(record));
  } catch {
    memoryThrottleState.clear();
    Object.entries(record).forEach(([key, value]) => {
      memoryThrottleState.set(key, cloneState(value));
    });
  }
}

function loadPersistedAuthThrottleState(identifier: string): AuthThrottleState | null {
  const normalizedIdentifier = normalizeThrottleIdentifier(identifier);
  if (!normalizedIdentifier) {
    return null;
  }

  const record = readPersistedAuthThrottleRecord();
  return record[normalizedIdentifier] ? cloneState(record[normalizedIdentifier]) : null;
}

function persistAuthThrottleState(identifier: string, state: AuthThrottleState): void {
  const normalizedIdentifier = normalizeThrottleIdentifier(identifier);
  if (!normalizedIdentifier) {
    return;
  }

  const record = readPersistedAuthThrottleRecord();
  if (state.failureCount <= 0 && state.cooldownUntil <= 0) {
    delete record[normalizedIdentifier];
  } else {
    record[normalizedIdentifier] = cloneState(state);
  }
  writePersistedAuthThrottleRecord(record);
}

export function createAuthThrottle(options: AuthThrottleOptions = {}): AuthThrottle {
  const threshold = Math.max(1, Math.floor(options.threshold ?? DEFAULT_THRESHOLD));
  const cooldownMs = Math.max(0, Math.floor(options.cooldownMs ?? DEFAULT_COOLDOWN_MS));
  const now = options.now ?? (() => Date.now());
  const onStateChange = options.onStateChange;

  let { failureCount, cooldownUntil } = normalizeThrottleState(options.initialState);

  function emitStateChange() {
    if (!onStateChange) {
      return;
    }

    onStateChange({
      failureCount,
      cooldownUntil,
    });
  }

  function clearExpiredCooldown() {
    if (cooldownUntil > 0 && now() >= cooldownUntil) {
      failureCount = 0;
      cooldownUntil = 0;
      emitStateChange();
    }
  }

  return {
    canAttempt() {
      clearExpiredCooldown();
      return cooldownUntil === 0;
    },
    recordFailure() {
      clearExpiredCooldown();
      failureCount += 1;
      if (failureCount >= threshold) {
        cooldownUntil = now() + cooldownMs;
      }
      emitStateChange();
    },
    recordSuccess() {
      failureCount = 0;
      cooldownUntil = 0;
      emitStateChange();
    },
    remainingCooldownMs() {
      clearExpiredCooldown();
      if (cooldownUntil === 0) {
        return 0;
      }

      return Math.max(0, cooldownUntil - now());
    },
  };
}

export function createPersistedAuthThrottle(
  identifier: string,
  options: Omit<AuthThrottleOptions, "initialState" | "onStateChange"> = {},
): AuthThrottle {
  const normalizedIdentifier = normalizeThrottleIdentifier(identifier);

  return createAuthThrottle({
    ...options,
    initialState: loadPersistedAuthThrottleState(normalizedIdentifier),
    onStateChange: (state) => {
      persistAuthThrottleState(normalizedIdentifier, state);
    },
  });
}
