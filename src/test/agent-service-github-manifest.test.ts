/* @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { createGitHubManifestService } from "../../agent_service/github-manifest.mjs";

function createConnection(overrides: Record<string, unknown> = {}) {
  return {
    id: "conn-1",
    installation_record_id: "install-rec-1",
    github_repo_id: 4242,
    owner_login: "legacy-owner",
    repo_name: "legacy-repo",
    full_name: "legacy-owner/legacy-repo",
    default_branch: "master",
    visibility: "private",
    is_private: true,
    installation: {
      id: "install-rec-1",
      github_installation_id: 777,
    },
    ...overrides,
  };
}

function createRepository(overrides: Record<string, unknown> = {}) {
  return {
    id: 4242,
    owner: {
      login: "legacy-owner",
    },
    name: "legacy-repo",
    full_name: "legacy-owner/legacy-repo",
    default_branch: "master",
    visibility: "private",
    private: true,
    ...overrides,
  };
}

function createManifestEntry(overrides: Record<string, unknown> = {}) {
  return {
    path: "src/index.ts",
    name: "index.ts",
    extension: ".ts",
    directory: "src",
    size: 128,
    sha: "blob-sha",
    language: "TypeScript",
    binary: false,
    generated: false,
    vendored: false,
    recommendedRank: 120,
    ...overrides,
  };
}

function createManifestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "manifest-1",
    repo_connection_id: "conn-1",
    ref_name: "default",
    tree_sha: "tree-sha",
    entry_count: 1,
    manifest: [createManifestEntry()],
    is_complete: true,
    generated_at: "2026-03-17T00:00:00.000Z",
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    invalidated_at: null,
    ...overrides,
  };
}

describe("agent service GitHub manifest", () => {
  it("refreshes connection metadata from the authoritative repository id before reading the tree", async () => {
    const app = {
      getRepositoryById: vi.fn().mockResolvedValue(createRepository({
        owner: {
          login: "next-owner",
        },
        name: "next-repo",
        full_name: "next-owner/next-repo",
        default_branch: "main",
      })),
      getBranch: vi.fn().mockResolvedValue({
        commit: {
          sha: "commit-sha",
          commit: {
            tree: {
              sha: "tree-sha",
            },
          },
        },
      }),
      getTree: vi.fn().mockResolvedValue({
        truncated: false,
        tree: [
          {
            type: "blob",
            path: "src/index.ts",
            size: 128,
            sha: "blob-sha",
          },
        ],
      }),
    };

    const store = {
      getManifest: vi.fn().mockResolvedValue(null),
      syncConnectionRepositoryMetadata: vi.fn().mockResolvedValue({
        id: "conn-1",
      }),
      upsertManifest: vi.fn().mockImplementation(async ({ manifest, treeSha }) => ({
        ...createManifestRow(),
        tree_sha: treeSha,
        entry_count: manifest.length,
        manifest,
      })),
    };

    const manifestService = createGitHubManifestService({
      app,
      store,
      ttlMs: 15 * 60_000,
    });

    const result = await manifestService.getManifestSnapshot({
      userId: "user-1",
      connection: createConnection(),
    });

    expect(app.getRepositoryById).toHaveBeenCalledWith(4242, 777);
    expect(store.syncConnectionRepositoryMetadata).toHaveBeenCalledWith(
      "conn-1",
      expect.objectContaining({
        full_name: "next-owner/next-repo",
        default_branch: "main",
      }),
    );
    expect(app.getBranch).toHaveBeenCalledWith("next-owner", "next-repo", "main", 777);
    expect(result.connection).toMatchObject({
      owner_login: "next-owner",
      repo_name: "next-repo",
      full_name: "next-owner/next-repo",
      default_branch: "main",
    });
  });

  it("falls back to the stored manifest when repository metadata lookup fails", async () => {
    const metadataError = Object.assign(new Error("GitHub unavailable"), { status: 503 });
    const manifestRow = createManifestRow();
    const app = {
      getRepositoryById: vi.fn().mockRejectedValue(metadataError),
      getBranch: vi.fn(),
      getTree: vi.fn(),
    };
    const store = {
      getManifest: vi.fn().mockResolvedValue(manifestRow),
    };

    const manifestService = createGitHubManifestService({ app, store });
    const result = await manifestService.getManifestSnapshot({
      userId: "user-1",
      connection: createConnection(),
    });

    expect(result.manifestRow).toBe(manifestRow);
    expect(result.staleFallback).toBe(true);
    expect(result.staleError).toBe(metadataError);
    expect(app.getBranch).not.toHaveBeenCalled();
    expect(app.getTree).not.toHaveBeenCalled();
  });

  it("falls back to the hot in-memory manifest cache when metadata lookup fails later", async () => {
    const metadataError = Object.assign(new Error("GitHub unavailable"), { status: 503 });
    const manifestRow = createManifestRow();
    const app = {
      getRepositoryById: vi.fn()
        .mockResolvedValueOnce(createRepository())
        .mockRejectedValueOnce(metadataError),
      getBranch: vi.fn().mockResolvedValue({
        commit: {
          sha: "commit-sha",
          commit: {
            tree: {
              sha: "tree-sha",
            },
          },
        },
      }),
      getTree: vi.fn().mockResolvedValue({
        truncated: false,
        tree: [
          {
            type: "blob",
            path: "src/index.ts",
            size: 128,
            sha: "blob-sha",
          },
        ],
      }),
    };
    const store = {
      getManifest: vi.fn().mockResolvedValueOnce(null),
      upsertManifest: vi.fn().mockResolvedValue(manifestRow),
    };

    const manifestService = createGitHubManifestService({ app, store });
    const connection = createConnection();

    const initial = await manifestService.getManifestSnapshot({
      userId: "user-1",
      connection,
    });
    const cached = await manifestService.getManifestSnapshot({
      userId: "user-1",
      connection,
    });

    expect(initial.staleFallback).toBe(false);
    expect(cached.manifestRow).toBe(manifestRow);
    expect(cached.staleFallback).toBe(true);
    expect(cached.staleError).toBe(metadataError);
    expect(store.getManifest).toHaveBeenCalledTimes(1);
    expect(app.getBranch).toHaveBeenCalledTimes(1);
  });

  it("still fails when repository metadata lookup fails and no usable manifest exists", async () => {
    const metadataError = Object.assign(new Error("GitHub unavailable"), { status: 503 });
    const manifestService = createGitHubManifestService({
      app: {
        getRepositoryById: vi.fn().mockRejectedValue(metadataError),
      },
      store: {
        getManifest: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(
      manifestService.getManifestSnapshot({
        userId: "user-1",
        connection: createConnection(),
      }),
    ).rejects.toMatchObject({
      message: "GitHub unavailable",
      status: 503,
    });
  });

  it("does not use stale manifest fallback when the default branch changed and a refresh fails", async () => {
    const refreshError = Object.assign(new Error("GitHub unavailable"), { status: 503 });
    const app = {
      getRepositoryById: vi.fn().mockResolvedValue(createRepository({
        default_branch: "main",
      })),
      getBranch: vi.fn().mockRejectedValue(refreshError),
      getTree: vi.fn(),
    };
    const store = {
      getManifest: vi.fn().mockResolvedValue(createManifestRow()),
      syncConnectionRepositoryMetadata: vi.fn().mockResolvedValue({
        id: "conn-1",
      }),
    };

    const manifestService = createGitHubManifestService({ app, store });

    await expect(
      manifestService.getManifestSnapshot({
        userId: "user-1",
        connection: createConnection(),
      }),
    ).rejects.toMatchObject({
      message: "GitHub unavailable",
      status: 503,
    });
  });

  it("repairs installation drift by probing the repository across the user's other active installations", async () => {
    const manifestRow = createManifestRow();
    const app = {
      getRepositoryById: vi.fn().mockImplementation(async (_repoId: number, installationId: number) => {
        if (installationId === 777) {
          throw Object.assign(new Error("Not Found"), { status: 404 });
        }
        if (installationId === 888) {
          return createRepository({
            owner: {
              login: "next-owner",
            },
            name: "next-repo",
            full_name: "next-owner/next-repo",
          });
        }
        throw new Error(`Unexpected installation id: ${installationId}`);
      }),
    };
    const store = {
      getManifest: vi.fn().mockResolvedValue(manifestRow),
      listInstallations: vi.fn().mockResolvedValue([
        {
          id: "install-rec-1",
          github_installation_id: 777,
        },
        {
          id: "install-rec-2",
          github_installation_id: 888,
        },
      ]),
      rebindConnectionToInstallationRecord: vi.fn().mockResolvedValue({
        id: "conn-1",
      }),
      syncConnectionRepositoryMetadata: vi.fn().mockResolvedValue({
        id: "conn-1",
      }),
    };

    const manifestService = createGitHubManifestService({ app, store });
    const result = await manifestService.getManifestSnapshot({
      userId: "user-1",
      connection: createConnection(),
    });

    expect(app.getRepositoryById).toHaveBeenNthCalledWith(1, 4242, 777);
    expect(app.getRepositoryById).toHaveBeenNthCalledWith(2, 4242, 888);
    expect(store.listInstallations).toHaveBeenCalledWith("user-1");
    expect(store.rebindConnectionToInstallationRecord).toHaveBeenCalledWith(
      "conn-1",
      "install-rec-2",
    );
    expect(store.syncConnectionRepositoryMetadata).toHaveBeenCalledWith(
      "conn-1",
      expect.objectContaining({
        full_name: "next-owner/next-repo",
      }),
    );
    expect(result.manifestRow).toBe(manifestRow);
    expect(result.staleFallback).toBe(false);
    expect(result.connection).toMatchObject({
      installation_record_id: "install-rec-2",
      owner_login: "next-owner",
      repo_name: "next-repo",
      full_name: "next-owner/next-repo",
      installation: {
        id: "install-rec-2",
        github_installation_id: 888,
      },
    });
  });
});
