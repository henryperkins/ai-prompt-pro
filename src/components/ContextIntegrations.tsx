import { useState } from "react";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Label } from "@/components/base/label";
import { Select } from "@/components/base/select/select";
import { Switch } from "@/components/base/primitives/switch";
import type { DatabaseConnection, RagParameters } from "@/lib/context-types";
import { Database, Plus, X } from "lucide-react";

interface ContextIntegrationsProps {
  databaseConnections: DatabaseConnection[];
  rag: RagParameters;
  onUpdateDatabaseConnections: (connections: DatabaseConnection[]) => void;
  onUpdateRag: (updates: Partial<RagParameters>) => void;
}

const PROVIDER_OPTIONS: DatabaseConnection["provider"][] = [
  "postgres",
  "mysql",
  "sqlite",
  "mongodb",
  "other",
];

export function ContextIntegrations({
  databaseConnections,
  rag,
  onUpdateDatabaseConnections,
  onUpdateRag,
}: ContextIntegrationsProps) {
  const [draft, setDraft] = useState<{
    label: string;
    provider: DatabaseConnection["provider"];
    connectionRef: string;
    database: string;
    schema: string;
    tables: string;
    readOnly: boolean;
  }>({
    label: "",
    provider: "postgres",
    connectionRef: "",
    database: "",
    schema: "",
    tables: "",
    readOnly: true,
  });

  const addDatabase = () => {
    if (!draft.connectionRef.trim() || !draft.database.trim()) return;
    const next: DatabaseConnection = {
      id: `db-${Date.now()}`,
      label: draft.label.trim() || draft.database.trim(),
      provider: draft.provider,
      connectionRef: draft.connectionRef.trim(),
      database: draft.database.trim(),
      schema: draft.schema.trim(),
      tables: draft.tables
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      readOnly: draft.readOnly,
      lastValidatedAt: Date.now(),
    };
    onUpdateDatabaseConnections([...databaseConnections, next]);
    setDraft({
      label: "",
      provider: draft.provider,
      connectionRef: "",
      database: "",
      schema: "",
      tables: "",
      readOnly: true,
    });
  };

  const removeDatabase = (id: string) => {
    onUpdateDatabaseConnections(databaseConnections.filter((db) => db.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground sm:text-base">Database connections</Label>
          <Badge type="modern" className="text-xs">
            {databaseConnections.length}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input
            value={draft.label}
            onChange={(value) => setDraft((prev) => ({ ...prev, label: value }))}
            placeholder="Label (optional)"
            wrapperClassName="h-11 sm:h-10"
          />
          <Select
            selectedKey={draft.provider}
            onSelectionChange={(provider) => {
              if (provider !== null) {
                setDraft((prev) => ({ ...prev, provider: String(provider) as DatabaseConnection["provider"] }));
              }
            }}
            className="capitalize"
            size="md"
          >
            {PROVIDER_OPTIONS.map((provider) => (
              <Select.Item key={provider} id={provider} className="capitalize">
                {provider}
              </Select.Item>
            ))}
          </Select>
          <Input
            value={draft.connectionRef}
            onChange={(value) => setDraft((prev) => ({ ...prev, connectionRef: value }))}
            placeholder="Connection ID (secret)"
            wrapperClassName="h-11 sm:h-10"
          />
          <Input
            value={draft.database}
            onChange={(value) => setDraft((prev) => ({ ...prev, database: value }))}
            placeholder="Database name"
            wrapperClassName="h-11 sm:h-10"
          />
          <Input
            value={draft.schema}
            onChange={(value) => setDraft((prev) => ({ ...prev, schema: value }))}
            placeholder="Schema (optional)"
            wrapperClassName="h-11 sm:h-10"
          />
          <Input
            value={draft.tables}
            onChange={(value) => setDraft((prev) => ({ ...prev, tables: value }))}
            placeholder="Tables (comma-separated, optional)"
            wrapperClassName="h-11 sm:h-10"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              checked={draft.readOnly}
              onCheckedChange={(value) => setDraft((prev) => ({ ...prev, readOnly: value }))}
            />
            <Label className="text-sm text-muted-foreground sm:text-base">Read-only</Label>
          </div>
          <Button size="sm" className="h-11 gap-1.5 text-sm sm:h-9 sm:text-sm" onClick={addDatabase}>
            <Plus className="w-3 h-3" />
            Add connection
          </Button>
        </div>

        {databaseConnections.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {databaseConnections.map((db) => (
              <Badge key={db.id} type="modern" className="gap-1.5 text-xs">
                <Database className="w-3 h-3" />
                {db.label}
                <button
                  onClick={() => removeDatabase(db.id)}
                  className="rounded-full p-0.5 hover:bg-destructive/20 transition-colors"
                  aria-label={`Remove ${db.label}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground sm:text-base">Retrieval settings (RAG)</Label>
          <Switch
            checked={rag.enabled}
            onCheckedChange={(enabled) => onUpdateRag({ enabled })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input
            value={rag.vectorStoreRef}
            onChange={(value) => onUpdateRag({ vectorStoreRef: value })}
            placeholder="Vector store ID"
            wrapperClassName="h-11 sm:h-10"
            isDisabled={!rag.enabled}
          />
          <Input
            value={rag.namespace}
            onChange={(value) => onUpdateRag({ namespace: value })}
            placeholder="Namespace"
            wrapperClassName="h-11 sm:h-10"
            isDisabled={!rag.enabled}
          />
          <Select
            selectedKey={rag.retrievalStrategy}
            onSelectionChange={(retrievalStrategy) => {
              if (retrievalStrategy !== null) {
                onUpdateRag({ retrievalStrategy: String(retrievalStrategy) as RagParameters["retrievalStrategy"] });
              }
            }}
            isDisabled={!rag.enabled}
            size="md"
          >
            <Select.Item id="hybrid">Hybrid</Select.Item>
            <Select.Item id="semantic">Semantic</Select.Item>
            <Select.Item id="keyword">Keyword</Select.Item>
          </Select>
          <Input
            value={String(rag.topK)}
            onChange={(value) => onUpdateRag({ topK: Number(value) || 0 })}
            placeholder="Top results (topK)"
            wrapperClassName="h-11 sm:h-10"
            isDisabled={!rag.enabled}
          />
          <Input
            value={String(rag.minScore)}
            onChange={(value) => onUpdateRag({ minScore: Number(value) || 0 })}
            placeholder="Minimum score (0-1)"
            wrapperClassName="h-11 sm:h-10"
            isDisabled={!rag.enabled}
          />
          <Input
            value={String(rag.chunkWindow)}
            onChange={(value) => onUpdateRag({ chunkWindow: Number(value) || 0 })}
            placeholder="Context window (chunks)"
            wrapperClassName="h-11 sm:h-10"
            isDisabled={!rag.enabled}
          />
        </div>
        <Input
          value={rag.documentRefs.join(", ")}
          onChange={(value) =>
            onUpdateRag({
              documentRefs: value
                .split(",")
                .map((ref) => ref.trim())
                .filter(Boolean),
            })
          }
          placeholder="Document IDs (comma-separated)"
          wrapperClassName="h-11 sm:h-10"
          isDisabled={!rag.enabled}
        />
      </div>
    </div>
  );
}
