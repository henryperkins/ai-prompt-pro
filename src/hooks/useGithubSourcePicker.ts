import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { MAX_ENHANCE_CONTEXT_SOURCE_COUNT } from "@/lib/enhance-context-sources";
import {
  GitHubClientError,
  buildGitHubContextSources,
  createGitHubConnection,
  getGitHubInstallUrl,
  listGitHubConnections,
  listGitHubInstallationRepositories,
  listGitHubInstallations,
  previewGitHubConnectionFile,
  searchGitHubConnectionFiles,
  type GitHubConnection,
  type GitHubFilePreview,
  type GitHubInstallation,
  type GitHubManifestEntry,
  type GitHubRepository,
} from "@/lib/github-client";
import type { ContextSource } from "@/lib/context-types";

interface UseGithubSourcePickerOptions {
  open: boolean;
  existingSourceCount: number;
  onAttachSources: (sources: ContextSource[]) => void;
  refreshKey?: number;
}

function getPickerErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof GitHubClientError && error.message.trim()) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function mergeRepositories(
  current: GitHubRepository[],
  incoming: GitHubRepository[],
): GitHubRepository[] {
  const byId = new Map<number, GitHubRepository>();
  current.forEach((repository) => {
    byId.set(repository.id, repository);
  });
  incoming.forEach((repository) => {
    byId.set(repository.id, repository);
  });
  return Array.from(byId.values());
}

function upsertConnection(
  current: GitHubConnection[],
  incoming: GitHubConnection,
): GitHubConnection[] {
  return [incoming, ...current.filter((connection) => connection.id !== incoming.id)];
}

function connectionToRepository(connection: GitHubConnection): GitHubRepository {
  return {
    id: connection.githubRepoId,
    ownerLogin: connection.ownerLogin,
    repoName: connection.repoName,
    fullName: connection.fullName,
    defaultBranch: connection.defaultBranch,
    visibility: connection.visibility,
    isPrivate: connection.isPrivate,
    connected: true,
    connectionId: connection.id,
  };
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

export function useGithubSourcePicker({
  open,
  existingSourceCount,
  onAttachSources,
  refreshKey,
}: UseGithubSourcePickerOptions) {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const isSignedIn = Boolean(user?.id);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isStartingInstall, setIsStartingInstall] = useState(false);
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [connections, setConnections] = useState<GitHubConnection[]>([]);
  const [selectedInstallationId, setSelectedInstallationId] = useState<number | null>(null);

  const [repoQuery, setRepoQuery] = useState("");
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [repoNextCursor, setRepoNextCursor] = useState<string | null>(null);
  const [isRepositoriesLoading, setIsRepositoriesLoading] = useState(false);
  const [isLoadingMoreRepositories, setIsLoadingMoreRepositories] = useState(false);
  const [selectedRepositoryFullName, setSelectedRepositoryFullName] = useState<string | null>(null);
  const [isConnectingRepository, setIsConnectingRepository] = useState(false);

  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [fileQuery, setFileQuery] = useState("");
  const [fileResults, setFileResults] = useState<GitHubManifestEntry[]>([]);
  const [fileSearchStaleFallback, setFileSearchStaleFallback] = useState(false);
  const [isFilesLoading, setIsFilesLoading] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [previewedFile, setPreviewedFile] = useState<GitHubFilePreview | null>(null);
  const [previewedConnectionId, setPreviewedConnectionId] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);

  const bootstrapRequestIdRef = useRef(0);
  const repositoryRequestIdRef = useRef(0);
  const fileRequestIdRef = useRef(0);
  const previewRequestIdRef = useRef(0);

  const selectedRepositoryFromList = useMemo(
    () =>
      selectedRepositoryFullName
        ? repositories.find((repository) => repository.fullName === selectedRepositoryFullName) || null
        : null,
    [repositories, selectedRepositoryFullName],
  );

  const selectedConnection = useMemo(() => {
    if (!selectedConnectionId) return null;
    const loadedConnection =
      connections.find((connection) => connection.id === selectedConnectionId) || null;
    if (loadedConnection) return loadedConnection;
    if (
      selectedRepositoryFromList?.connected &&
      selectedRepositoryFromList.connectionId === selectedConnectionId
    ) {
      return {
        id: selectedConnectionId,
        githubRepoId: selectedRepositoryFromList.id,
        ownerLogin: selectedRepositoryFromList.ownerLogin,
        repoName: selectedRepositoryFromList.repoName,
        fullName: selectedRepositoryFromList.fullName,
        defaultBranch: selectedRepositoryFromList.defaultBranch,
        visibility: selectedRepositoryFromList.visibility,
        isPrivate: selectedRepositoryFromList.isPrivate,
        installationRecordId: "",
        lastSelectedAt: null,
      };
    }
    return null;
  }, [connections, selectedConnectionId, selectedRepositoryFromList]);

  const selectedRepository = useMemo(
    () => selectedRepositoryFromList || (selectedConnection ? connectionToRepository(selectedConnection) : null),
    [selectedConnection, selectedRepositoryFromList],
  );

  const resetFileSelectionState = useCallback(
    (options: { preserveQuery?: boolean } = {}) => {
      setSelectedPaths([]);
      setFileResults([]);
      setFileSearchStaleFallback(false);
      setPreviewedFile(null);
      setPreviewedConnectionId(null);
      if (!options.preserveQuery) {
        setFileQuery("");
      }
    },
    [],
  );

  const refreshData = useCallback(async () => {
    if (!isSignedIn) return;

    const requestId = ++bootstrapRequestIdRef.current;
    setIsBootstrapping(true);
    setErrorMessage(null);

    try {
      const [installationResponse, connectionResponse] = await Promise.all([
        listGitHubInstallations(),
        listGitHubConnections(),
      ]);

      if (requestId !== bootstrapRequestIdRef.current) return;

      const nextInstallations = installationResponse.installations;
      const nextConnections = connectionResponse.connections;

      setInstallations(nextInstallations);
      setConnections(nextConnections);
      setSelectedInstallationId((previous) => {
        if (
          previous &&
          nextInstallations.some(
            (installation) => installation.githubInstallationId === previous,
          )
        ) {
          return previous;
        }
        return nextInstallations[0]?.githubInstallationId ?? null;
      });
      setSelectedConnectionId((previous) => {
        if (!previous) return previous;
        return nextConnections.some((connection) => connection.id === previous)
          ? previous
          : null;
      });
    } catch (error) {
      if (requestId !== bootstrapRequestIdRef.current) return;
      setErrorMessage(
        getPickerErrorMessage(error, "GitHub connections could not be loaded."),
      );
    } finally {
      if (requestId === bootstrapRequestIdRef.current) {
        setIsBootstrapping(false);
      }
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (!open || authLoading || !isSignedIn) return;
    void refreshData();
  }, [authLoading, isSignedIn, open, refreshData, refreshKey]);

  useEffect(() => {
    if (isSignedIn) return;
    setInstallations([]);
    setConnections([]);
    setRepositories([]);
    setRepoNextCursor(null);
    setSelectedInstallationId(null);
    setSelectedRepositoryFullName(null);
    setSelectedConnectionId(null);
    resetFileSelectionState();
  }, [isSignedIn, resetFileSelectionState]);

  useEffect(() => {
    if (selectedConnectionId) return;
    setFileResults([]);
    setFileSearchStaleFallback(false);
    setSelectedPaths([]);
    setPreviewedFile(null);
    setPreviewedConnectionId(null);
  }, [selectedConnectionId]);

  const loadRepositories = useCallback(
    async ({ append = false, cursor }: { append?: boolean; cursor?: string | null } = {}) => {
      if (!selectedInstallationId) {
        setRepositories([]);
        setRepoNextCursor(null);
        return;
      }

      const requestId = ++repositoryRequestIdRef.current;
      if (append) {
        setIsLoadingMoreRepositories(true);
      } else {
        setIsRepositoriesLoading(true);
      }

      try {
        const response = await listGitHubInstallationRepositories({
          installationId: selectedInstallationId,
          query: repoQuery.trim() || undefined,
          cursor,
          limit: 50,
        });

        if (requestId !== repositoryRequestIdRef.current) return;

        setRepositories((previous) =>
          append
            ? mergeRepositories(previous, response.repositories)
            : response.repositories,
        );
        setRepoNextCursor(response.nextCursor);
        setErrorMessage(null);
      } catch (error) {
        if (requestId !== repositoryRequestIdRef.current) return;
        setErrorMessage(
          getPickerErrorMessage(error, "GitHub repositories could not be loaded."),
        );
      } finally {
        if (requestId === repositoryRequestIdRef.current) {
          setIsRepositoriesLoading(false);
          setIsLoadingMoreRepositories(false);
        }
      }
    },
    [repoQuery, selectedInstallationId],
  );

  useEffect(() => {
    if (!open || !isSignedIn || !selectedInstallationId) return;
    const timeoutId = globalThis.setTimeout(() => {
      void loadRepositories();
    }, repoQuery.trim() ? 200 : 0);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [isSignedIn, loadRepositories, open, repoQuery, selectedInstallationId]);

  const loadMoreRepositories = useCallback(async () => {
    if (!repoNextCursor || isLoadingMoreRepositories) return;
    await loadRepositories({ append: true, cursor: repoNextCursor });
  }, [isLoadingMoreRepositories, loadRepositories, repoNextCursor]);

  const loadFiles = useCallback(async () => {
    if (!selectedConnectionId) {
      setFileResults([]);
      setFileSearchStaleFallback(false);
      return;
    }

    const requestId = ++fileRequestIdRef.current;
    setIsFilesLoading(true);

    try {
      const response = await searchGitHubConnectionFiles({
        connectionId: selectedConnectionId,
        query: fileQuery.trim() || undefined,
        limit: 50,
      });

      if (requestId !== fileRequestIdRef.current) return;

      setFileResults(response.results);
      setFileSearchStaleFallback(response.staleFallback);
      setErrorMessage(null);
    } catch (error) {
      if (requestId !== fileRequestIdRef.current) return;
      setErrorMessage(
        getPickerErrorMessage(error, "Repository files could not be loaded."),
      );
    } finally {
      if (requestId === fileRequestIdRef.current) {
        setIsFilesLoading(false);
      }
    }
  }, [fileQuery, selectedConnectionId]);

  useEffect(() => {
    if (!open || !isSignedIn || !selectedConnectionId) return;
    const timeoutId = globalThis.setTimeout(() => {
      void loadFiles();
    }, fileQuery.trim() ? 200 : 0);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [fileQuery, isSignedIn, loadFiles, open, selectedConnectionId]);

  const startInstall = useCallback(async () => {
    if (!isSignedIn) {
      setErrorMessage("Sign in required.");
      return;
    }

    setIsStartingInstall(true);
    try {
      const installUrl = await getGitHubInstallUrl();
      window.location.assign(installUrl);
    } catch (error) {
      const message = getPickerErrorMessage(
        error,
        "GitHub setup could not be started.",
      );
      setErrorMessage(message);
      toast({
        title: "GitHub setup failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsStartingInstall(false);
    }
  }, [isSignedIn, toast]);

  const selectInstallation = useCallback(
    (installationId: number) => {
      setSelectedInstallationId(installationId);
      setSelectedRepositoryFullName(null);
      setSelectedConnectionId(null);
      setRepositories([]);
      setRepoNextCursor(null);
      resetFileSelectionState();
    },
    [resetFileSelectionState],
  );

  const selectRepository = useCallback(
    (repository: GitHubRepository) => {
      const isAlreadyActive = Boolean(
        repository.connectionId && repository.connectionId === selectedConnectionId,
      );
      setSelectedRepositoryFullName(repository.fullName);
      if (!isAlreadyActive) {
        setSelectedConnectionId(null);
        resetFileSelectionState();
      }
    },
    [resetFileSelectionState, selectedConnectionId],
  );

  const activateConnection = useCallback(
    (connection: GitHubConnection) => {
      const isAlreadyActive = selectedConnectionId === connection.id;
      setSelectedRepositoryFullName(connection.fullName);
      if (!isAlreadyActive) {
        setSelectedConnectionId(connection.id);
        resetFileSelectionState();
      }
    },
    [resetFileSelectionState, selectedConnectionId],
  );

  const activateSelectedRepository = useCallback(async () => {
    if (!selectedRepository || !selectedInstallationId) return false;

    if (selectedRepository.connected && selectedRepository.connectionId) {
      const isAlreadyActive =
        selectedConnectionId === selectedRepository.connectionId;
      setSelectedRepositoryFullName(selectedRepository.fullName);
      if (!isAlreadyActive) {
        setSelectedConnectionId(selectedRepository.connectionId);
        resetFileSelectionState();
      }
      return true;
    }

    setIsConnectingRepository(true);
    try {
      const response = await createGitHubConnection({
        installationId: selectedInstallationId,
        ownerLogin: selectedRepository.ownerLogin,
        repoName: selectedRepository.repoName,
      });
      const connection = response.connection;

      setConnections((previous) => upsertConnection(previous, connection));
      setRepositories((previous) =>
        previous.map((repository) =>
          repository.fullName === selectedRepository.fullName
            ? {
              ...repository,
              connected: true,
              connectionId: connection.id,
            }
            : repository,
        ),
      );
      setSelectedRepositoryFullName(connection.fullName);
      setSelectedConnectionId(connection.id);
      resetFileSelectionState();
      setErrorMessage(null);
      return true;
    } catch (error) {
      const message = getPickerErrorMessage(
        error,
        "The selected repository could not be connected.",
      );
      setErrorMessage(message);
      toast({
        title: "Repository connection failed",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsConnectingRepository(false);
    }
  }, [
    resetFileSelectionState,
    selectedConnectionId,
    selectedInstallationId,
    selectedRepository,
    toast,
  ]);

  const toggleSelectedPath = useCallback((path: string) => {
    setSelectedPaths((previous) => {
      if (previous.includes(path)) {
        return previous.filter((entry) => entry !== path);
      }
      return [...previous, path];
    });
  }, []);

  const previewFile = useCallback(
    async (path: string) => {
      if (!selectedConnectionId) return;
      if (
        previewedConnectionId === selectedConnectionId &&
        previewedFile?.path === path
      ) {
        return;
      }

      const requestId = ++previewRequestIdRef.current;
      setIsPreviewLoading(true);

      try {
        const response = await previewGitHubConnectionFile({
          connectionId: selectedConnectionId,
          path,
        });
        if (requestId !== previewRequestIdRef.current) return;

        setPreviewedFile(response.file);
        setPreviewedConnectionId(selectedConnectionId);
        setErrorMessage(null);
      } catch (error) {
        if (requestId !== previewRequestIdRef.current) return;
        const message = getPickerErrorMessage(
          error,
          "The selected file preview could not be loaded.",
        );
        setErrorMessage(message);
        toast({
          title: "Preview unavailable",
          description: message,
          variant: "destructive",
        });
      } finally {
        if (requestId === previewRequestIdRef.current) {
          setIsPreviewLoading(false);
        }
      }
    },
    [previewedConnectionId, previewedFile?.path, selectedConnectionId, toast],
  );

  const remainingAttachmentSlots = Math.max(
    0,
    MAX_ENHANCE_CONTEXT_SOURCE_COUNT - existingSourceCount,
  );
  const attachDisabledReason = useMemo(() => {
    if (existingSourceCount >= MAX_ENHANCE_CONTEXT_SOURCE_COUNT) {
      return `You already have ${MAX_ENHANCE_CONTEXT_SOURCE_COUNT} attached sources. Remove one before adding GitHub files.`;
    }
    if (selectedPaths.length > remainingAttachmentSlots) {
      return `Select ${remainingAttachmentSlots} or fewer ${pluralize(remainingAttachmentSlots, "file")} to stay within the ${MAX_ENHANCE_CONTEXT_SOURCE_COUNT}-source cap.`;
    }
    return null;
  }, [existingSourceCount, remainingAttachmentSlots, selectedPaths.length]);

  const canAttach =
    Boolean(selectedConnectionId) &&
    selectedPaths.length > 0 &&
    !attachDisabledReason;

  const attachSelectedFiles = useCallback(async () => {
    if (!selectedConnectionId || selectedPaths.length === 0 || attachDisabledReason) {
      return false;
    }

    setIsAttaching(true);
    try {
      const response = await buildGitHubContextSources({
        connectionId: selectedConnectionId,
        paths: selectedPaths,
      });

      if (!Array.isArray(response.sources) || response.sources.length === 0) {
        throw new GitHubClientError({
          message: "No GitHub files were returned by the service.",
          code: "bad_response",
        });
      }

      onAttachSources(response.sources);
      setSelectedPaths([]);
      setErrorMessage(null);
      toast({
        title:
          response.sources.length === 1
            ? "GitHub file attached"
            : "GitHub files attached",
        description: `Added ${response.sources.length} ${pluralize(response.sources.length, "file")} from ${selectedConnection?.fullName || "the selected repository"}.`,
      });
      return true;
    } catch (error) {
      const message = getPickerErrorMessage(
        error,
        "The selected GitHub files could not be attached.",
      );
      setErrorMessage(message);
      toast({
        title: "Attachment failed",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsAttaching(false);
    }
  }, [
    attachDisabledReason,
    onAttachSources,
    selectedConnection?.fullName,
    selectedConnectionId,
    selectedPaths,
    toast,
  ]);

  return {
    authLoading,
    isSignedIn,
    errorMessage,
    isBootstrapping,
    isStartingInstall,
    installations,
    connections,
    selectedInstallationId,
    repoQuery,
    repositories,
    repoNextCursor,
    isRepositoriesLoading,
    isLoadingMoreRepositories,
    selectedRepository,
    selectedConnection,
    fileQuery,
    fileResults,
    fileSearchStaleFallback,
    selectedPaths,
    previewedFile,
    isFilesLoading,
    isConnectingRepository,
    isPreviewLoading,
    isAttaching,
    remainingAttachmentSlots,
    canAttach,
    attachDisabledReason,
    startInstall,
    refreshData,
    selectInstallation,
    setRepoQuery,
    loadMoreRepositories,
    selectRepository,
    activateConnection,
    activateSelectedRepository,
    setFileQuery,
    toggleSelectedPath,
    previewFile,
    attachSelectedFiles,
  };
}
