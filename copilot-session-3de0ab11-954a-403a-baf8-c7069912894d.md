# 🤖 Copilot CLI Session

> **Session ID:** `3de0ab11-954a-403a-baf8-c7069912894d`
> **Started:** 2/9/2026, 9:46:39 PM
> **Duration:** 4m 11s
> **Exported:** 2/9/2026, 9:50:51 PM

<sub>⏱️ 0s</sub>

### ℹ️ Info

🧪 Experimental mode is enabled. These features are not stable, may have bugs, and may be removed in the future.

---

<sub>⏱️ 0s</sub>

### ℹ️ Info

💡 No copilot instructions found. Run /init to generate a copilot-instructions.md file for this project.

---

<sub>⏱️ 9s</sub>

### ℹ️ Info

Model changed to: claude-opus-4.6 (high)

---

<sub>⏱️ 35s</sub>

### 👤 User

Review uncomitted changes and identify regressions, issues and gaps.

---

<sub>⏱️ 37s</sub>

### 💬 Copilot



I'll review the uncommitted changes in the repository.

---

<sub>⏱️ 40s</sub>

### ✅ `bash`

**Check git status**

$ cd /home/azureuser/ai-prompt-pro && git --no-pager status

<details>
<summary>24 lines</summary>

```
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   .codex/index/graph.json
	modified:   .codex/index/meta.json
	modified:   .codex/index/vectors.db
	modified:   .gitignore
	modified:   src/App.tsx
	modified:   src/components/Header.tsx
	modified:   src/hooks/usePromptBuilder.ts
	modified:   src/integrations/supabase/types.ts
	modified:   src/lib/template-store.ts
	modified:   src/pages/Index.tsx

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	src/components/AuthDialog.tsx
	src/hooks/useAuth.tsx
	src/lib/persistence.ts
	src/test/persistence.test.ts
	supabase/migrations/

no changes added to commit (use "git add" and/or "git commit -a")
<exited with exit code 0>
```

</details>


---

<sub>⏱️ 40s</sub>

### ✅ `bash`

**Check diff stats**

$ cd /home/azureuser/ai-prompt-pro && git --no-pager diff --stat

<details>
<summary>12 lines</summary>

```
.codex/index/graph.json            | 1602 ++++++++++++++++++++++++++++++++++++++++------------------------------------
 .codex/index/meta.json             |  700 +++++++++++++++++----------------
 .codex/index/vectors.db            |  Bin 13471744 -> 13524992 bytes
 .gitignore                         |    3 +
 src/App.tsx                        |   25 +-
 src/components/Header.tsx          |  140 +++++--
 src/hooks/usePromptBuilder.ts      |  394 ++++++++++++++-----
 src/integrations/supabase/types.ts |  141 ++++++-
 src/lib/template-store.ts          |   26 +-
 src/pages/Index.tsx                |   56 ++-
 10 files changed, 1797 insertions(+), 1290 deletions(-)
<exited with exit code 0>
```

</details>


---

<sub>⏱️ 43s</sub>

### ✅ `bash`

**Get full diff of source changes**

$ cd /home/azureuser/ai-prompt-pro && git --no-pager diff -- src/ .gitignore | head -3000

<details>
<summary>8 lines</summary>

```diff
Output too large to read at once (34.8 KB). Saved to: /tmp/copilot-tool-output-1770673643078-32zbtw.txt
Consider using tools like grep (for searching), head/tail (for viewing start/end), view with view_range (for specific sections), or jq (for JSON) to examine portions of the output.

Preview (first 500 chars):
diff --git a/.gitignore b/.gitignore
index a547bf3..effaf10 100644
--- a/.gitignore
+++ b/.gitignore
<exited with exit code 0>
```

</details>


---

<sub>⏱️ 49s</sub>

### ✅ `bash`

**Read diff for UI and config files**

$ cd /home/azureuser/ai-prompt-pro && git --no-pager diff -- .gitignore src/App.tsx src/components/Header.tsx src/pages/Index.tsx src/lib/template-store.ts

<details>
<summary>384 lines</summary>

```diff
diff --git a/.gitignore b/.gitignore
index a547bf3..effaf10 100644
--- a/.gitignore
+++ b/.gitignore
@@ -22,3 +22,6 @@ dist-ssr
 *.njsproj
 *.sln
 *.sw?
+
+# Supabase CLI cache
+supabase/.temp/
diff --git a/src/App.tsx b/src/App.tsx
index 18daf2e..78aed79 100644
--- a/src/App.tsx
+++ b/src/App.tsx
@@ -3,6 +3,7 @@ import { Toaster as Sonner } from "@/components/ui/sonner";
 import { TooltipProvider } from "@/components/ui/tooltip";
 import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
 import { BrowserRouter, Routes, Route } from "react-router-dom";
+import { AuthProvider } from "@/hooks/useAuth";
 import Index from "./pages/Index";
 import NotFound from "./pages/NotFound";
 
@@ -10,17 +11,19 @@ const queryClient = new QueryClient();
 
 const App = () => (
   <QueryClientProvider client={queryClient}>
-    <TooltipProvider>
-      <Toaster />
-      <Sonner />
-      <BrowserRouter>
-        <Routes>
-          <Route path="/" element={<Index />} />
-          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
-          <Route path="*" element={<NotFound />} />
-        </Routes>
-      </BrowserRouter>
-    </TooltipProvider>
+    <AuthProvider>
+      <TooltipProvider>
+        <Toaster />
+        <Sonner />
+        <BrowserRouter>
+          <Routes>
+            <Route path="/" element={<Index />} />
+            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
+            <Route path="*" element={<NotFound />} />
+          </Routes>
+        </BrowserRouter>
+      </TooltipProvider>
+    </AuthProvider>
   </QueryClientProvider>
 );
 
diff --git a/src/components/Header.tsx b/src/components/Header.tsx
index 7b86476..af9f72f 100644
--- a/src/components/Header.tsx
+++ b/src/components/Header.tsx
@@ -1,5 +1,15 @@
-import { Moon, Sun, Zap, BookOpen, History } from "lucide-react";
+import { useState } from "react";
+import { Moon, Sun, Zap, BookOpen, History, LogIn, LogOut } from "lucide-react";
 import { Button } from "@/components/ui/button";
+import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
+import {
+  DropdownMenu,
+  DropdownMenuContent,
+  DropdownMenuItem,
+  DropdownMenuTrigger,
+} from "@/components/ui/dropdown-menu";
+import { useAuth } from "@/hooks/useAuth";
+import { AuthDialog } from "@/components/AuthDialog";
 
 interface HeaderProps {
   isDark: boolean;
@@ -9,48 +19,98 @@ interface HeaderProps {
 }
 
 export function Header({ isDark, onToggleTheme, onOpenTemplates, onOpenHistory }: HeaderProps) {
+  const { user, signOut } = useAuth();
+  const [authOpen, setAuthOpen] = useState(false);
+
+  const initials = user?.user_metadata?.full_name
+    ? (user.user_metadata.full_name as string)
+        .split(" ")
+        .map((n: string) => n[0])
+        .join("")
+        .slice(0, 2)
+        .toUpperCase()
+    : user?.email
+      ? user.email[0].toUpperCase()
+      : "?";
+
   return (
-    <header className="border-b border-border/80 bg-card/75 backdrop-blur-md sticky top-0 z-50">
-      <div className="container mx-auto flex items-center justify-between h-12 sm:h-14 px-3 sm:px-4">
-        <div className="flex items-center gap-1.5 sm:gap-2">
-          <div className="interactive-chip flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary text-primary-foreground">
-            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
+    <>
+      <header className="border-b border-border/80 bg-card/75 backdrop-blur-md sticky top-0 z-50">
+        <div className="container mx-auto flex items-center justify-between h-12 sm:h-14 px-3 sm:px-4">
+          <div className="flex items-center gap-1.5 sm:gap-2">
+            <div className="interactive-chip flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary text-primary-foreground">
+              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
+            </div>
+            <span className="text-base sm:text-lg font-bold text-foreground tracking-tight">PromptForge</span>
           </div>
-          <span className="text-base sm:text-lg font-bold text-foreground tracking-tight">PromptForge</span>
+
+          <nav className="flex items-center gap-0.5 sm:gap-1">
+            <Button
+              variant="ghost"
+              size="sm"
+              onClick={onOpenTemplates}
+              aria-label="Open presets"
+              className="interactive-chip gap-1.5 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
+            >
+              <BookOpen className="w-4 h-4" />
+              <span className="hidden sm:inline text-sm">Presets</span>
+            </Button>
+            <Button
+              variant="ghost"
+              size="sm"
+              onClick={onOpenHistory}
+              aria-label="Open version history"
+              className="interactive-chip gap-1.5 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
+            >
+              <History className="w-4 h-4" />
+              <span className="hidden sm:inline text-sm">History</span>
+            </Button>
+            <Button
+              variant="ghost"
+              size="icon"
+              onClick={onToggleTheme}
+              aria-label="Toggle theme"
+              className="interactive-chip w-8 h-8 sm:w-9 sm:h-9"
+            >
+              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
+            </Button>
+
+            {user ? (
+              <DropdownMenu>
+                <DropdownMenuTrigger asChild>
+                  <Button variant="ghost" size="icon" className="interactive-chip w-8 h-8 sm:w-9 sm:h-9 rounded-full p-0">
+                    <Avatar className="w-7 h-7 sm:w-8 sm:h-8">
+                      <AvatarImage src={user.user_metadata?.avatar_url as string | undefined} />
+                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
+                    </Avatar>
+                  </Button>
+                </DropdownMenuTrigger>
+                <DropdownMenuContent align="end">
+                  <DropdownMenuItem disabled className="text-xs text-muted-foreground">
+                    {user.email}
+                  </DropdownMenuItem>
+                  <DropdownMenuItem onClick={() => signOut()}>
+                    <LogOut className="w-4 h-4 mr-2" />
+                    Sign out
+                  </DropdownMenuItem>
+                </DropdownMenuContent>
+              </DropdownMenu>
+            ) : (
+              <Button
+                variant="ghost"
+                size="sm"
+                onClick={() => setAuthOpen(true)}
+                className="interactive-chip gap-1.5 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
+              >
+                <LogIn className="w-4 h-4" />
+                <span className="hidden sm:inline text-sm">Sign in</span>
+              </Button>
+            )}
+          </nav>
         </div>
+      </header>
 
-        <nav className="flex items-center gap-0.5 sm:gap-1">
-          <Button
-            variant="ghost"
-            size="sm"
-            onClick={onOpenTemplates}
-            aria-label="Open presets"
-            className="interactive-chip gap-1.5 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
-          >
-            <BookOpen className="w-4 h-4" />
-            <span className="hidden sm:inline text-sm">Presets</span>
-          </Button>
-          <Button
-            variant="ghost"
-            size="sm"
-            onClick={onOpenHistory}
-            aria-label="Open version history"
-            className="interactive-chip gap-1.5 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
-          >
-            <History className="w-4 h-4" />
-            <span className="hidden sm:inline text-sm">History</span>
-          </Button>
-          <Button
-            variant="ghost"
-            size="icon"
-            onClick={onToggleTheme}
-            aria-label="Toggle theme"
-            className="interactive-chip w-8 h-8 sm:w-9 sm:h-9"
-          >
-            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
-          </Button>
-        </nav>
-      </div>
-    </header>
+      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
+    </>
   );
 }
diff --git a/src/lib/template-store.ts b/src/lib/template-store.ts
index 016ebe1..2643ada 100644
--- a/src/lib/template-store.ts
+++ b/src/lib/template-store.ts
@@ -185,7 +185,7 @@ function mergeContextConfig(input?: ContextConfig): ContextConfig {
   };
 }
 
-function normalizePromptConfig(config: PromptConfig): PromptConfig {
+export function normalizeTemplateConfig(config: PromptConfig): PromptConfig {
   const merged: PromptConfig = {
     ...defaultConfig,
     ...config,
@@ -203,7 +203,7 @@ function normalizePromptConfig(config: PromptConfig): PromptConfig {
   };
 }
 
-function fingerprintFromConfig(config: PromptConfig): string {
+export function computeTemplateFingerprint(config: PromptConfig): string {
   const canonical = cloneDeep(config);
   canonical.contextConfig.sources = canonical.contextConfig.sources.map((source) => ({
     ...source,
@@ -312,7 +312,7 @@ function validateRag(rag: RagParameters): string[] {
   return warnings;
 }
 
-function collectWarnings(config: PromptConfig): string[] {
+export function collectTemplateWarnings(config: PromptConfig): string[] {
   const warnings: string[] = [];
   config.contextConfig.sources.forEach((source) => {
     if (source.validation?.status === "invalid") {
@@ -429,7 +429,7 @@ function parseEnvelope(raw: string | null): TemplateEnvelope {
 
 function migrateLegacyV1(legacy: LegacyTemplateRecordV1): TemplateRecord {
   const now = Date.now();
-  const config: PromptConfig = normalizePromptConfig({
+  const config: PromptConfig = normalizeTemplateConfig({
     ...defaultConfig,
     role: legacy.role || "",
     task: legacy.task || "",
@@ -441,7 +441,7 @@ function migrateLegacyV1(legacy: LegacyTemplateRecordV1): TemplateRecord {
     constraints: Array.isArray(legacy.constraints) ? legacy.constraints : [],
     examples: legacy.examples || "",
   });
-  const fingerprint = fingerprintFromConfig(config);
+  const fingerprint = computeTemplateFingerprint(config);
   return {
     metadata: {
       id: legacy.id || generateId("tpl"),
@@ -468,7 +468,7 @@ function parseTemplateRecord(raw: unknown): TemplateRecord | null {
     const metadata = raw.metadata;
     const state = raw.state;
     if (typeof metadata.name !== "string" || typeof metadata.id !== "string") return null;
-    const normalizedConfig = normalizePromptConfig((state.promptConfig || defaultConfig) as PromptConfig);
+    const normalizedConfig = normalizeTemplateConfig((state.promptConfig || defaultConfig) as PromptConfig);
     const externalReferences = Array.isArray(state.externalReferences)
       ? (state.externalReferences as TemplateExternalReference[])
       : externalReferencesFromConfig(normalizedConfig);
@@ -485,7 +485,7 @@ function parseTemplateRecord(raw: unknown): TemplateRecord | null {
         fingerprint:
           typeof metadata.fingerprint === "string"
             ? metadata.fingerprint
-            : fingerprintFromConfig(normalizedConfig),
+            : computeTemplateFingerprint(normalizedConfig),
         createdAt: typeof metadata.createdAt === "number" ? metadata.createdAt : Date.now(),
         updatedAt: typeof metadata.updatedAt === "number" ? metadata.updatedAt : Date.now(),
       },
@@ -542,7 +542,7 @@ function clipText(value: string, limit: number): string {
   return `${value.slice(0, limit - 3).trimEnd()}...`;
 }
 
-function inferStarterPrompt(config: PromptConfig): string {
+export function inferTemplateStarterPrompt(config: PromptConfig): string {
   const candidates = [
     config.task,
     config.originalPrompt,
@@ -562,7 +562,7 @@ export function listTemplateSummaries(): TemplateSummary[] {
     name: record.metadata.name,
     description: record.metadata.description,
     tags: record.metadata.tags,
-    starterPrompt: inferStarterPrompt(record.state.promptConfig),
+    starterPrompt: inferTemplateStarterPrompt(record.state.promptConfig),
     updatedAt: record.metadata.updatedAt,
     createdAt: record.metadata.createdAt,
     revision: record.metadata.revision,
@@ -579,7 +579,7 @@ export function loadTemplateById(id: string): TemplateLoadResult | null {
   if (!record) return null;
   return {
     record: cloneDeep(record),
-    warnings: collectWarnings(record.state.promptConfig),
+    warnings: collectTemplateWarnings(record.state.promptConfig),
   };
 }
 
@@ -588,9 +588,9 @@ export function saveTemplateSnapshot(input: TemplateSaveInput): SaveTemplateResu
   if (!name) throw new Error("Preset name is required.");
 
   const now = Date.now();
-  const normalizedConfig = normalizePromptConfig(input.config);
-  const fingerprint = fingerprintFromConfig(normalizedConfig);
-  const warnings = collectWarnings(normalizedConfig);
+  const normalizedConfig = normalizeTemplateConfig(input.config);
+  const fingerprint = computeTemplateFingerprint(normalizedConfig);
+  const warnings = collectTemplateWarnings(normalizedConfig);
   const records = readAllRecords();
   const existingIndex = records.findIndex((record) => record.metadata.name.toLowerCase() === name.toLowerCase());
 
diff --git a/src/pages/Index.tsx b/src/pages/Index.tsx
index 722aba4..cdfb38f 100644
--- a/src/pages/Index.tsx
+++ b/src/pages/Index.tsx
@@ -198,39 +198,55 @@ const Index = () => {
   );
 
   const handleSelectSavedTemplate = useCallback(
-    (id: string) => {
-      const loaded = loadSavedTemplate(id);
-      if (!loaded) {
-        toast({ title: "Preset not found", variant: "destructive" });
-        return;
+    async (id: string) => {
+      try {
+        const loaded = await loadSavedTemplate(id);
+        if (!loaded) {
+          toast({ title: "Preset not found", variant: "destructive" });
+          return;
+        }
+        toast({
+          title: `Preset loaded: ${loaded.record.metadata.name}`,
+          description:
+            loaded.warnings.length > 0
+              ? `${loaded.warnings.length} context warning(s). Review integrations before running.`
+              : "Preset restored successfully.",
+        });
+      } catch (error) {
+        toast({
+          title: "Failed to load preset",
+          description: error instanceof Error ? error.message : "Unexpected error",
+          variant: "destructive",
+        });
       }
-      toast({
-        title: `Preset loaded: ${loaded.record.metadata.name}`,
-        description:
-          loaded.warnings.length > 0
-            ? `${loaded.warnings.length} context warning(s). Review integrations before running.`
-            : "Preset restored successfully.",
-      });
     },
     [loadSavedTemplate, toast]
   );
 
   const handleDeleteSavedTemplate = useCallback(
-    (id: string) => {
-      const deleted = deleteSavedTemplate(id);
-      if (!deleted) {
-        toast({ title: "Preset not found", variant: "destructive" });
-        return;
+    async (id: string) => {
+      try {
+        const deleted = await deleteSavedTemplate(id);
+        if (!deleted) {
+          toast({ title: "Preset not found", variant: "destructive" });
+          return;
+        }
+        toast({ title: "Saved preset deleted" });
+      } catch (error) {
+        toast({
+          title: "Failed to delete preset",
+          description: error instanceof Error ? error.message : "Unexpected error",
+          variant: "destructive",
+        });
       }
-      toast({ title: "Saved preset deleted" });
     },
     [deleteSavedTemplate, toast]
   );
 
   const handleSaveAsTemplate = useCallback(
-    (input: { name: string; description?: string; tags?: string[] }) => {
+    async (input: { name: string; description?: string; tags?: string[] }) => {
       try {
-        const result = saveAsTemplate(input);
+        const result = await saveAsTemplate(input);
         const warningText =
           result.warnings.length > 0
             ? ` ${result.warnings.length} validation warning(s) were recorded.`
<exited with exit code 0>
```

</details>


---

<sub>⏱️ 49s</sub>

### ✅ `bash`

**Read diff for hooks and types**

$ cd /home/azureuser/ai-prompt-pro && git --no-pager diff -- src/hooks/usePromptBuilder.ts src/integrations/supabase/types.ts

<details>
<summary>610 lines</summary>

```diff
diff --git a/src/hooks/usePromptBuilder.ts b/src/hooks/usePromptBuilder.ts
index 1e3c2c0..b05e475 100644
--- a/src/hooks/usePromptBuilder.ts
+++ b/src/hooks/usePromptBuilder.ts
@@ -1,4 +1,4 @@
-import { useState, useCallback, useEffect } from "react";
+import { useState, useCallback, useEffect, useRef } from "react";
 import { PromptConfig, defaultConfig, buildPrompt, scorePrompt } from "@/lib/prompt-builder";
 import type {
   ContextSource,
@@ -9,16 +9,17 @@ import type {
 } from "@/lib/context-types";
 import { defaultContextConfig } from "@/lib/context-types";
 import {
-  deleteTemplateById,
-  listTemplateSummaries,
-  loadTemplateById,
-  saveTemplateSnapshot,
+  listTemplateSummaries as listLocalTemplateSummaries,
   type SaveTemplateResult,
   type TemplateLoadResult,
   type TemplateSummary,
 } from "@/lib/template-store";
+import { useAuth } from "@/hooks/useAuth";
+import { useToast } from "@/hooks/use-toast";
+import * as persistence from "@/lib/persistence";
 
 const STORAGE_KEY = "promptforge-draft";
+const DRAFT_AUTOSAVE_DELAY_MS = 700;
 
 function hydrateConfig(raw: unknown): PromptConfig {
   if (!raw || typeof raw !== "object") return defaultConfig;
@@ -53,46 +54,179 @@ function hydrateConfig(raw: unknown): PromptConfig {
   };
 }
 
-export function usePromptBuilder() {
-  const [config, setConfig] = useState<PromptConfig>(() => {
-    try {
-      const saved = localStorage.getItem(STORAGE_KEY);
-      return saved ? hydrateConfig(JSON.parse(saved)) : defaultConfig;
-    } catch {
-      return defaultConfig;
-    }
-  });
+function loadLocalDraft(): PromptConfig {
+  try {
+    const saved = localStorage.getItem(STORAGE_KEY);
+    return saved ? hydrateConfig(JSON.parse(saved)) : defaultConfig;
+  } catch {
+    return defaultConfig;
+  }
+}
 
+export function usePromptBuilder() {
+  const { user } = useAuth();
+  const { toast } = useToast();
+  const userId = user?.id ?? null;
+  const [config, setConfig] = useState<PromptConfig>(loadLocalDraft);
   const [enhancedPrompt, setEnhancedPrompt] = useState("");
   const [isEnhancing, setIsEnhancing] = useState(false);
-  const [versions, setVersions] = useState<{ id: string; name: string; prompt: string; timestamp: number }[]>([]);
-  const [templateSummaries, setTemplateSummaries] = useState<TemplateSummary[]>(() => listTemplateSummaries());
+  const [versions, setVersions] = useState<persistence.PromptVersion[]>([]);
+  const [templateSummaries, setTemplateSummaries] = useState<TemplateSummary[]>(() =>
+    listLocalTemplateSummaries(),
+  );
+  const [isDraftDirty, setIsDraftDirty] = useState(false);
+  const [isCloudHydrated, setIsCloudHydrated] = useState(false);
+
+  const prevUserId = useRef<string | null>(null);
+  const draftSaveError = useRef<string | null>(null);
+  const authLoadToken = useRef(0);
+  const autosaveToken = useRef(0);
+  const editsSinceAuthChange = useRef(false);
 
-  const refreshTemplateSummaries = useCallback(() => {
-    setTemplateSummaries(listTemplateSummaries());
+  const showPersistenceError = useCallback(
+    (title: string, error: unknown, fallback: string) => {
+      toast({
+        title,
+        description: persistence.getPersistenceErrorMessage(error, fallback),
+        variant: "destructive",
+      });
+    },
+    [toast],
+  );
+
+  const markDraftDirty = useCallback(() => {
+    editsSinceAuthChange.current = true;
+    setIsDraftDirty(true);
   }, []);
 
-  // Auto-save
+  // Load draft/templates/versions when the auth identity changes.
   useEffect(() => {
-    const timeout = setTimeout(() => {
+    if (userId === prevUserId.current) return;
+    prevUserId.current = userId;
+    draftSaveError.current = null;
+    editsSinceAuthChange.current = false;
+    setIsDraftDirty(false);
+
+    const token = ++authLoadToken.current;
+
+    if (!userId) {
+      setIsCloudHydrated(true);
+      setConfig(loadLocalDraft());
+      setTemplateSummaries(listLocalTemplateSummaries());
+      setVersions([]);
+      return;
+    }
+
+    setIsCloudHydrated(false);
+
+    void Promise.allSettled([
+      persistence.loadDraft(userId),
+      persistence.loadTemplates(userId),
+      persistence.loadVersions(userId),
+    ]).then(([draftResult, templatesResult, versionsResult]) => {
+      if (token !== authLoadToken.current) return;
+
+      if (draftResult.status === "fulfilled") {
+        if (draftResult.value && !editsSinceAuthChange.current) {
+          setConfig(hydrateConfig(draftResult.value));
+        }
+      } else {
+        showPersistenceError("Failed to load draft", draftResult.reason, "Failed to load draft.");
+      }
+
+      if (templatesResult.status === "fulfilled") {
+        setTemplateSummaries(templatesResult.value);
+      } else {
+        setTemplateSummaries([]);
+        showPersistenceError("Failed to load presets", templatesResult.reason, "Failed to load presets.");
+      }
+
+      if (versionsResult.status === "fulfilled") {
+        setVersions(versionsResult.value);
+      } else {
+        setVersions([]);
+        showPersistenceError(
+          "Failed to load version history",
+          versionsResult.reason,
+          "Failed to load version history.",
+        );
+      }
+
+      setIsCloudHydrated(true);
+      if (!editsSinceAuthChange.current) {
+        setIsDraftDirty(false);
+      }
+    });
+  }, [userId, showPersistenceError]);
+
+  const refreshTemplateSummaries = useCallback(async () => {
+    if (userId) {
+      try {
+        const summaries = await persistence.loadTemplates(userId);
+        setTemplateSummaries(summaries);
+      } catch (error) {
+        showPersistenceError("Failed to refresh presets", error, "Failed to refresh presets.");
+      }
+    } else {
+      setTemplateSummaries(listLocalTemplateSummaries());
+    }
+  }, [userId, showPersistenceError]);
+
+  const saveDraftSafely = useCallback(
+    async (nextConfig: PromptConfig, saveToken: number) => {
       try {
-        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
-      } catch {
-        // Ignore quota errors to avoid runtime crashes.
+        await persistence.saveDraft(userId, nextConfig);
+        draftSaveError.current = null;
+        if (saveToken === autosaveToken.current) {
+          setIsDraftDirty(false);
+        }
+      } catch (error) {
+        const message = persistence.getPersistenceErrorMessage(error, "Failed to save draft.");
+        if (draftSaveError.current !== message) {
+          draftSaveError.current = message;
+          toast({
+            title: "Draft auto-save failed",
+            description: message,
+            variant: "destructive",
+          });
+        }
       }
-    }, 500);
+    },
+    [userId, toast],
+  );
+
+  // Auto-save draft (debounced)
+  useEffect(() => {
+    if (!isDraftDirty) return;
+    if (userId && !isCloudHydrated) return;
+
+    const saveToken = ++autosaveToken.current;
+    const timeout = setTimeout(() => {
+      void saveDraftSafely(config, saveToken);
+    }, DRAFT_AUTOSAVE_DELAY_MS);
+
     return () => clearTimeout(timeout);
-  }, [config]);
+  }, [config, isDraftDirty, userId, isCloudHydrated, saveDraftSafely]);
 
-  const updateConfig = useCallback((updates: Partial<PromptConfig>) => {
-    setConfig((prev) => ({ ...prev, ...updates }));
-  }, []);
+  const updateConfig = useCallback(
+    (updates: Partial<PromptConfig>) => {
+      setConfig((prev) => ({ ...prev, ...updates }));
+      markDraftDirty();
+    },
+    [markDraftDirty],
+  );
 
   const resetConfig = useCallback(() => {
     setConfig(defaultConfig);
     setEnhancedPrompt("");
-    localStorage.removeItem(STORAGE_KEY);
-  }, []);
+    if (!userId) {
+      persistence.clearLocalDraft();
+      setIsDraftDirty(false);
+      editsSinceAuthChange.current = false;
+      return;
+    }
+    markDraftDirty();
+  }, [userId, markDraftDirty]);
 
   const clearOriginalPrompt = useCallback(() => {
     setConfig((prev) => ({
@@ -100,63 +234,92 @@ export function usePromptBuilder() {
       originalPrompt: "",
     }));
     setEnhancedPrompt("");
-  }, []);
+    markDraftDirty();
+  }, [markDraftDirty]);
 
   // Context-specific updaters
-  const updateContextSources = useCallback((sources: ContextSource[]) => {
-    setConfig((prev) => ({
-      ...prev,
-      contextConfig: { ...prev.contextConfig, sources },
-    }));
-  }, []);
+  const updateContextSources = useCallback(
+    (sources: ContextSource[]) => {
+      setConfig((prev) => ({
+        ...prev,
+        contextConfig: { ...prev.contextConfig, sources },
+      }));
+      markDraftDirty();
+    },
+    [markDraftDirty],
+  );
 
-  const updateDatabaseConnections = useCallback((databaseConnections: DatabaseConnection[]) => {
-    setConfig((prev) => ({
-      ...prev,
-      contextConfig: { ...prev.contextConfig, databaseConnections },
-    }));
-  }, []);
+  const updateDatabaseConnections = useCallback(
+    (databaseConnections: DatabaseConnection[]) => {
+      setConfig((prev) => ({
+        ...prev,
+        contextConfig: { ...prev.contextConfig, databaseConnections },
+      }));
+      markDraftDirty();
+    },
+    [markDraftDirty],
+  );
 
-  const updateRagParameters = useCallback((ragUpdates: Partial<RagParameters>) => {
-    setConfig((prev) => ({
-      ...prev,
-      contextConfig: {
-        ...prev.contextConfig,
-        rag: { ...prev.contextConfig.rag, ...ragUpdates },
-      },
-    }));
-  }, []);
+  const updateRagParameters = useCallback(
+    (ragUpdates: Partial<RagParameters>) => {
+      setConfig((prev) => ({
+        ...prev,
+        contextConfig: {
+          ...prev.contextConfig,
+          rag: { ...prev.contextConfig.rag, ...ragUpdates },
+        },
+      }));
+      markDraftDirty();
+    },
+    [markDraftDirty],
+  );
 
-  const updateContextStructured = useCallback((updates: Partial<StructuredContext>) => {
-    setConfig((prev) => ({
-      ...prev,
-      contextConfig: {
-        ...prev.contextConfig,
-        structured: { ...prev.contextConfig.structured, ...updates },
-      },
-    }));
-  }, []);
+  const updateContextStructured = useCallback(
+    (updates: Partial<StructuredContext>) => {
+      setConfig((prev) => ({
+        ...prev,
+        contextConfig: {
+          ...prev.contextConfig,
+          structured: { ...prev.contextConfig.structured, ...updates },
+        },
+      }));
+      markDraftDirty();
+    },
+    [markDraftDirty],
+  );
 
-  const updateContextInterview = useCallback((answers: InterviewAnswer[]) => {
-    setConfig((prev) => ({
-      ...prev,
-      contextConfig: { ...prev.contextConfig, interviewAnswers: answers },
-    }));
-  }, []);
+  const updateContextInterview = useCallback(
+    (answers: InterviewAnswer[]) => {
+      setConfig((prev) => ({
+        ...prev,
+        contextConfig: { ...prev.contextConfig, interviewAnswers: answers },
+      }));
+      markDraftDirty();
+    },
+    [markDraftDirty],
+  );
 
-  const updateProjectNotes = useCallback((notes: string) => {
-    setConfig((prev) => ({
-      ...prev,
-      contextConfig: { ...prev.contextConfig, projectNotes: notes },
-    }));
-  }, []);
+  const updateProjectNotes = useCallback(
+    (notes: string) => {
+      setConfig((prev) => ({
+        ...prev,
+        contextConfig: { ...prev.contextConfig, projectNotes: notes },
+      }));
+      markDraftDirty();
+    },
+    [markDraftDirty],
+  );
 
-  const toggleDelimiters = useCallback((value: boolean) => {
-    setConfig((prev) => ({
-      ...prev,
-      contextConfig: { ...prev.contextConfig, useDelimiters: value },
-    }));
-  }, []);
+  const toggleDelimiters = useCallback(
+    (value: boolean) => {
+      setConfig((prev) => ({
+        ...prev,
+        contextConfig: { ...prev.contextConfig, useDelimiters: value },
+      }));
+      markDraftDirty();
+    },
+    [markDraftDirty],
+  );
 
   const builtPrompt = buildPrompt(config);
   const score = scorePrompt(config);
@@ -165,15 +328,28 @@ export function usePromptBuilder() {
     (name?: string) => {
       const promptToSave = enhancedPrompt || builtPrompt;
       if (!promptToSave) return;
-      const version = {
-        id: Date.now().toString(),
-        name: name || `Version ${versions.length + 1}`,
-        prompt: promptToSave,
-        timestamp: Date.now(),
-      };
-      setVersions((prev) => [version, ...prev]);
+      const versionName = name || `Version ${versions.length + 1}`;
+
+      if (userId) {
+        void persistence
+          .saveVersion(userId, versionName, promptToSave)
+          .then((saved) => {
+            if (saved) setVersions((prev) => [saved, ...prev]);
+          })
+          .catch((error) => {
+            showPersistenceError("Failed to save version", error, "Failed to save version.");
+          });
+      } else {
+        const version: persistence.PromptVersion = {
+          id: Date.now().toString(),
+          name: versionName,
+          prompt: promptToSave,
+          timestamp: Date.now(),
+        };
+        setVersions((prev) => [version, ...prev]);
+      }
     },
-    [enhancedPrompt, builtPrompt, versions.length]
+    [enhancedPrompt, builtPrompt, versions.length, userId, showPersistenceError],
   );
 
   const loadTemplate = useCallback(
@@ -201,37 +377,43 @@ export function usePromptBuilder() {
         examples: template.examples,
       });
       setEnhancedPrompt("");
+      markDraftDirty();
     },
-    []
+    [markDraftDirty],
   );
 
   const saveAsTemplate = useCallback(
-    (input: { name: string; description?: string; tags?: string[] }): SaveTemplateResult => {
-      const result = saveTemplateSnapshot({
-        ...input,
-        config,
-      });
-      refreshTemplateSummaries();
+    async (input: {
+      name: string;
+      description?: string;
+      tags?: string[];
+    }): Promise<SaveTemplateResult> => {
+      const result = await persistence.saveTemplate(userId, { ...input, config });
+      await refreshTemplateSummaries();
       return result;
     },
-    [config, refreshTemplateSummaries]
+    [config, userId, refreshTemplateSummaries],
   );
 
-  const loadSavedTemplate = useCallback((id: string): TemplateLoadResult | null => {
-    const loaded = loadTemplateById(id);
-    if (!loaded) return null;
-    setConfig(hydrateConfig(loaded.record.state.promptConfig));
-    setEnhancedPrompt("");
-    return loaded;
-  }, []);
+  const loadSavedTemplate = useCallback(
+    async (id: string): Promise<TemplateLoadResult | null> => {
+      const loaded = await persistence.loadTemplateById(userId, id);
+      if (!loaded) return null;
+      setConfig(hydrateConfig(loaded.record.state.promptConfig));
+      setEnhancedPrompt("");
+      markDraftDirty();
+      return loaded;
+    },
+    [userId, markDraftDirty],
+  );
 
   const deleteSavedTemplate = useCallback(
-    (id: string): boolean => {
-      const deleted = deleteTemplateById(id);
-      if (deleted) refreshTemplateSummaries();
+    async (id: string): Promise<boolean> => {
+      const deleted = await persistence.deleteTemplate(userId, id);
+      if (deleted) await refreshTemplateSummaries();
       return deleted;
     },
-    [refreshTemplateSummaries]
+    [userId, refreshTemplateSummaries],
   );
 
   return {
diff --git a/src/integrations/supabase/types.ts b/src/integrations/supabase/types.ts
index 54fedf1..b1f2eed 100644
--- a/src/integrations/supabase/types.ts
+++ b/src/integrations/supabase/types.ts
@@ -14,7 +14,146 @@ export type Database = {
   }
   public: {
     Tables: {
-      [_ in never]: never
+      drafts: {
+        Row: {
+          id: string
+          user_id: string
+          config: Json
+          updated_at: string
+        }
+        Insert: {
+          id?: string
+          user_id: string
+          config?: Json
+          updated_at?: string
+        }
+        Update: {
+          id?: string
+          user_id?: string
+          config?: Json
+          updated_at?: string
+        }
+        Relationships: [
+          {
+            foreignKeyName: "drafts_user_id_fkey"
+            columns: ["user_id"]
+            isOneToOne: true
+            referencedRelation: "users"
+            referencedColumns: ["id"]
+          },
+        ]
+      }
+      profiles: {
+        Row: {
+          id: string
+          display_name: string | null
+          avatar_url: string | null
+          created_at: string
+          updated_at: string
+        }
+        Insert: {
+          id: string
+          display_name?: string | null
+          avatar_url?: string | null
+          created_at?: string
+          updated_at?: string
+        }
+        Update: {
+          id?: string
+          display_name?: string | null
+          avatar_url?: string | null
+          created_at?: string
+          updated_at?: string
+        }
+        Relationships: [
+          {
+            foreignKeyName: "profiles_id_fkey"
+            columns: ["id"]
+            isOneToOne: true
+            referencedRelation: "users"
+            referencedColumns: ["id"]
+          },
+        ]
+      }
+      prompt_versions: {
+        Row: {
+          id: string
+          user_id: string
+          name: string
+          prompt: string
+          created_at: string
+        }
+        Insert: {
+          id?: string
+          user_id: string
+          name: string
+          prompt: string
+          created_at?: string
+        }
+        Update: {
+          id?: string
+          user_id?: string
+          name?: string
+          prompt?: string
+          created_at?: string
+        }
+        Relationships: [
+          {
+            foreignKeyName: "prompt_versions_user_id_fkey"
+            columns: ["user_id"]
+            isOneToOne: false
+            referencedRelation: "users"
+            referencedColumns: ["id"]
+          },
+        ]
+      }
+      templates: {
+        Row: {
+          id: string
+          user_id: string
+          name: string
+          description: string
+          tags: string[]
+          config: Json
+          fingerprint: string | null
+          revision: number
+          created_at: string
+          updated_at: string
+        }
+        Insert: {
+          id?: string
+          user_id: string
+          name: string
+          description?: string
+          tags?: string[]
+          config?: Json
+          fingerprint?: string | null
+          revision?: number
+          created_at?: string
+          updated_at?: string
+        }
+        Update: {
+          id?: string
+          user_id?: string
+          name?: string
+          description?: string
+          tags?: string[]
+          config?: Json
+          fingerprint?: string | null
+          revision?: number
+          created_at?: string
+          updated_at?: string
+        }
+        Relationships: [
+          {
+            foreignKeyName: "templates_user_id_fkey"
+            columns: ["user_id"]
+            isOneToOne: false
+            referencedRelation: "users"
+            referencedColumns: ["id"]
+          },
+        ]
+      }
     }
     Views: {
       [_ in never]: never
<exited with exit code 0>
```

</details>


---

<sub>⏱️ 49s</sub>

### ✅ `bash`

**Read new files**

$ cd /home/azureuser/ai-prompt-pro && cat src/components/AuthDialog.tsx src/hooks/useAuth.tsx src/lib/persistence.ts src/test/persistence.test.ts

<details>
<summary>771 lines</summary>

```
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

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
      setConfirmationSent(true);
      return;
    }

    // Login succeeded — close
    onOpenChange(false);
    resetForm();
  };

  const handleOAuth = async (provider: "github" | "google") => {
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "login" ? "Sign in" : "Create account"}
          </DialogTitle>
        </DialogHeader>

        {confirmationSent ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Check your email for a confirmation link, then sign in.
            </p>
            <Button variant="outline" onClick={() => { setMode("login"); setConfirmationSent(false); }}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* OAuth buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => handleOAuth("github")}>
                <GitHubIcon className="w-4 h-4 mr-2" />
                GitHub
              </Button>
              <Button variant="outline" onClick={() => handleOAuth("google")}>
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
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User, Session, Provider } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithOAuth: (provider: Provider) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      // Ignore anonymous sessions — treat them as unauthenticated
      if (s?.user?.is_anonymous) {
        setSession(null);
        setUser(null);
      } else {
        setSession(s);
        setUser(s?.user ?? null);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s?.user?.is_anonymous) {
        setSession(null);
        setUser(null);
      } else {
        setSession(s);
        setUser(s?.user ?? null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signInWithOAuth = useCallback(async (provider: Provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signUp, signIn, signInWithOAuth, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { PromptConfig } from "@/lib/prompt-builder";
import { defaultConfig } from "@/lib/prompt-builder";
import {
  collectTemplateWarnings,
  computeTemplateFingerprint,
  inferTemplateStarterPrompt,
  listTemplateSummaries as listLocalTemplates,
  loadTemplateById as loadLocalTemplate,
  normalizeTemplateConfig,
  saveTemplateSnapshot as saveLocalTemplate,
  deleteTemplateById as deleteLocalTemplate,
  type TemplateSummary,
  type TemplateLoadResult,
  type SaveTemplateResult,
  type TemplateSaveInput,
} from "@/lib/template-store";

const DRAFT_KEY = "promptforge-draft";
const TEMPLATE_SELECT_COLUMNS =
  "id, name, description, tags, config, fingerprint, revision, created_at, updated_at";

type PersistenceErrorCode = "unauthorized" | "conflict" | "network" | "unknown";

export class PersistenceError extends Error {
  readonly code: PersistenceErrorCode;

  constructor(code: PersistenceErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PersistenceError";
    this.code = code;
  }
}

export function getPersistenceErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function isPostgrestError(value: unknown): value is PostgrestError {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.message === "string" && typeof candidate.code === "string";
}

function mapPostgrestError(error: PostgrestError, fallback: string): PersistenceError {
  const message = (error.message || fallback).trim() || fallback;
  const isUnauthorized =
    error.code === "42501" ||
    /row-level security|permission denied|insufficient privilege|not authenticated|jwt/i.test(message);

  if (isUnauthorized) {
    return new PersistenceError("unauthorized", message, { cause: error });
  }

  if (error.code === "23505") {
    return new PersistenceError("conflict", message, { cause: error });
  }

  return new PersistenceError("unknown", message, { cause: error });
}

function toPersistenceError(error: unknown, fallback: string): PersistenceError {
  if (error instanceof PersistenceError) return error;
  if (isPostgrestError(error)) return mapPostgrestError(error, fallback);
  if (error instanceof Error) {
    if (/network|failed to fetch|fetch failed|connection/i.test(error.message)) {
      return new PersistenceError("network", error.message, { cause: error });
    }
    return new PersistenceError("unknown", error.message || fallback, { cause: error });
  }
  return new PersistenceError("unknown", fallback, { cause: error });
}

function normalizeTags(tags?: string[]): string[] | undefined {
  if (!Array.isArray(tags)) return undefined;
  return tags.map((tag) => tag.trim()).filter(Boolean);
}

type TemplateRow = {
  id: string;
  name: string;
  description: string;
  tags: string[] | null;
  config: Json | null;
  fingerprint: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Draft persistence
// ---------------------------------------------------------------------------

export async function loadDraft(userId: string | null): Promise<PromptConfig | null> {
  if (!userId) {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? (JSON.parse(raw) as PromptConfig) : null;
    } catch {
      return null;
    }
  }

  try {
    const { data, error } = await supabase
      .from("drafts")
      .select("config")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw mapPostgrestError(error, "Failed to load cloud draft.");
    if (!data) return null;
    return data.config as unknown as PromptConfig;
  } catch (error) {
    throw toPersistenceError(error, "Failed to load cloud draft.");
  }
}

export async function saveDraft(userId: string | null, config: PromptConfig): Promise<void> {
  if (!userId) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(config));
    } catch {
      // quota errors are intentionally ignored to keep the UI responsive
    }
    return;
  }

  try {
    const { error } = await supabase.from("drafts").upsert(
      {
        user_id: userId,
        config: config as unknown as Json,
      },
      { onConflict: "user_id" },
    );
    if (error) throw mapPostgrestError(error, "Failed to save cloud draft.");
  } catch (error) {
    throw toPersistenceError(error, "Failed to save cloud draft.");
  }
}

export function clearLocalDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Template / Preset persistence
// ---------------------------------------------------------------------------

export async function loadTemplates(userId: string | null): Promise<TemplateSummary[]> {
  if (!userId) return listLocalTemplates();

  try {
    const { data, error } = await supabase
      .from("templates")
      .select(TEMPLATE_SELECT_COLUMNS)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) throw mapPostgrestError(error, "Failed to load presets.");
    if (!data) return [];

    return data.map((row) => {
      const cfg = normalizeTemplateConfig((row.config ?? defaultConfig) as unknown as PromptConfig);
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        tags: row.tags ?? [],
        starterPrompt: inferTemplateStarterPrompt(cfg),
        updatedAt: new Date(row.updated_at).getTime(),
        createdAt: new Date(row.created_at).getTime(),
        revision: row.revision,
        schemaVersion: 2,
        sourceCount: cfg.contextConfig.sources.length,
        databaseCount: cfg.contextConfig.databaseConnections.length,
        ragEnabled: cfg.contextConfig.rag.enabled,
      };
    });
  } catch (error) {
    throw toPersistenceError(error, "Failed to load presets.");
  }
}

export async function loadTemplateById(
  userId: string | null,
  id: string,
): Promise<TemplateLoadResult | null> {
  if (!userId) return loadLocalTemplate(id);

  try {
    const { data, error } = await supabase
      .from("templates")
      .select(TEMPLATE_SELECT_COLUMNS)
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw mapPostgrestError(error, "Failed to load preset.");
    if (!data) return null;

    const cfg = normalizeTemplateConfig((data.config ?? defaultConfig) as unknown as PromptConfig);
    return {
      record: rowToRecord(data, cfg),
      warnings: collectTemplateWarnings(cfg),
    };
  } catch (error) {
    throw toPersistenceError(error, "Failed to load preset.");
  }
}

export async function saveTemplate(
  userId: string | null,
  input: TemplateSaveInput,
): Promise<SaveTemplateResult> {
  if (!userId) return saveLocalTemplate(input);

  const name = input.name.trim();
  if (!name) throw new PersistenceError("unknown", "Preset name is required.");

  const normalizedConfig = normalizeTemplateConfig(input.config);
  const fingerprint = computeTemplateFingerprint(normalizedConfig);
  const warnings = collectTemplateWarnings(normalizedConfig);
  const tags = normalizeTags(input.tags);

  try {
    const { data: existingRows, error: lookupError } = await supabase
      .from("templates")
      .select(TEMPLATE_SELECT_COLUMNS)
      .eq("user_id", userId)
      .ilike("name", name)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (lookupError) throw mapPostgrestError(lookupError, "Failed to save preset.");
    const existing = existingRows?.[0] ?? null;

    if (existing?.fingerprint === fingerprint) {
      return {
        outcome: "unchanged",
        record: rowToRecord(existing, normalizedConfig),
        warnings,
      };
    }

    if (existing) {
      const { data: updated, error } = await supabase
        .from("templates")
        .update({
          description: input.description?.trim() || existing.description,
          tags: tags ?? existing.tags ?? [],
          config: normalizedConfig as unknown as Json,
          fingerprint,
          revision: existing.revision + 1,
        })
        .eq("id", existing.id)
        .eq("user_id", userId)
        .select(TEMPLATE_SELECT_COLUMNS)
        .single();

      if (error) throw mapPostgrestError(error, "Failed to update preset.");
      if (!updated) throw new PersistenceError("unknown", "Preset update returned no data.");
      return {
        outcome: "updated",
        record: rowToRecord(updated, normalizedConfig),
        warnings,
      };
    }

    const { data: created, error: insertError } = await supabase
      .from("templates")
      .insert({
        user_id: userId,
        name,
        description: input.description?.trim() || "",
        tags: tags ?? [],
        config: normalizedConfig as unknown as Json,
        fingerprint,
      })
      .select(TEMPLATE_SELECT_COLUMNS)
      .single();

    if (insertError) {
      throw mapPostgrestError(insertError, "Failed to save preset.");
    }
    if (!created) throw new PersistenceError("unknown", "Preset save returned no data.");

    return {
      outcome: "created",
      record: rowToRecord(created, normalizedConfig),
      warnings,
    };
  } catch (error) {
    throw toPersistenceError(error, "Failed to save preset.");
  }
}

export async function deleteTemplate(userId: string | null, id: string): Promise<boolean> {
  if (!userId) return deleteLocalTemplate(id);

  try {
    const { data, error } = await supabase
      .from("templates")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();

    if (error) throw mapPostgrestError(error, "Failed to delete preset.");
    return !!data;
  } catch (error) {
    throw toPersistenceError(error, "Failed to delete preset.");
  }
}

// ---------------------------------------------------------------------------
// Prompt versions
// ---------------------------------------------------------------------------

export interface PromptVersion {
  id: string;
  name: string;
  prompt: string;
  timestamp: number;
}

export async function loadVersions(userId: string | null): Promise<PromptVersion[]> {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from("prompt_versions")
      .select("id, name, prompt, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw mapPostgrestError(error, "Failed to load version history.");
    if (!data) return [];

    return data.map((row) => ({
      id: row.id,
      name: row.name,
      prompt: row.prompt,
      timestamp: new Date(row.created_at).getTime(),
    }));
  } catch (error) {
    throw toPersistenceError(error, "Failed to load version history.");
  }
}

export async function saveVersion(
  userId: string | null,
  name: string,
  prompt: string,
): Promise<PromptVersion | null> {
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from("prompt_versions")
      .insert({ user_id: userId, name, prompt })
      .select("id, name, prompt, created_at")
      .single();

    if (error) throw mapPostgrestError(error, "Failed to save version.");
    if (!data) throw new PersistenceError("unknown", "Version save returned no data.");

    return {
      id: data.id,
      name: data.name,
      prompt: data.prompt,
      timestamp: new Date(data.created_at).getTime(),
    };
  } catch (error) {
    throw toPersistenceError(error, "Failed to save version.");
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToRecord(row: TemplateRow, normalizedConfig?: PromptConfig) {
  const cfg = normalizedConfig || normalizeTemplateConfig((row.config ?? defaultConfig) as unknown as PromptConfig);
  return {
    metadata: {
      id: row.id,
      name: row.name,
      description: row.description,
      tags: row.tags ?? [],
      schemaVersion: 2,
      revision: row.revision,
      fingerprint: row.fingerprint ?? "",
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    },
    state: {
      promptConfig: cfg,
      externalReferences: [],
    },
  };
}
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultConfig, type PromptConfig } from "@/lib/prompt-builder";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
  },
}));

function buildConfig(overrides?: Partial<PromptConfig>): PromptConfig {
  return {
    ...defaultConfig,
    ...overrides,
    contextConfig: {
      ...defaultConfig.contextConfig,
      ...overrides?.contextConfig,
      sources: overrides?.contextConfig?.sources || [],
      databaseConnections: overrides?.contextConfig?.databaseConnections || [],
      rag: {
        ...defaultConfig.contextConfig.rag,
        ...overrides?.contextConfig?.rag,
      },
      structured: {
        ...defaultConfig.contextConfig.structured,
        ...overrides?.contextConfig?.structured,
      },
      interviewAnswers: overrides?.contextConfig?.interviewAnswers || [],
    },
  };
}

describe("persistence", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("normalizes template payloads before cloud insert and preserves warnings", async () => {
    const { saveTemplate } = await import("@/lib/persistence");
    let insertedPayload: Record<string, unknown> | null = null;

    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          ilike: () => ({
            order: () => ({
              limit: async () => ({ data: [], error: null }),
            }),
          }),
        }),
      }),
    });

    fromMock.mockReturnValueOnce({
      insert: (payload: Record<string, unknown>) => {
        insertedPayload = payload;
        return {
          select: () => ({
            single: async () => ({
              data: {
                id: "tpl_1",
                name: payload.name,
                description: payload.description,
                tags: payload.tags,
                config: payload.config,
                fingerprint: payload.fingerprint,
                revision: 1,
                created_at: "2026-02-09T00:00:00.000Z",
                updated_at: "2026-02-09T00:00:00.000Z",
              },
              error: null,
            }),
          }),
        };
      },
    });

    const result = await saveTemplate("user_1", {
      name: "Risky",
      config: buildConfig({
        task: "Investigate incident",
        contextConfig: {
          ...defaultConfig.contextConfig,
          sources: [
            {
              id: "url-1",
              type: "url",
              title: "Runbook",
              rawContent: "https://example.com/runbook",
              summary: "",
              addedAt: Date.now(),
            },
          ],
          databaseConnections: [
            {
              id: "db-1",
              label: "Primary",
              provider: "postgres",
              connectionRef: "",
              database: "app",
              schema: "public",
              tables: ["events"],
              readOnly: false,
            },
          ],
          rag: {
            ...defaultConfig.contextConfig.rag,
            enabled: true,
            vectorStoreRef: "",
            topK: 0,
          },
        },
      }),
    });

    const source = (insertedPayload?.config as PromptConfig).contextConfig.sources[0];
    expect(source.rawContent).toBe("");
    expect(typeof insertedPayload?.fingerprint).toBe("string");
    expect(result.outcome).toBe("created");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("returns false on delete when no row is removed", async () => {
    const { deleteTemplate } = await import("@/lib/persistence");

    fromMock.mockReturnValueOnce({
      delete: () => ({
        eq: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    });

    await expect(deleteTemplate("user_1", "missing")).resolves.toBe(false);
  });

  it("throws typed unauthorized errors for load failures", async () => {
    const { loadTemplateById } = await import("@/lib/persistence");

    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: null,
              error: {
                code: "42501",
                message: 'new row violates row-level security policy for table "templates"',
                details: "",
                hint: "",
              },
            }),
          }),
        }),
      }),
    });

    await expect(loadTemplateById("user_1", "tpl_1")).rejects.toMatchObject({
      name: "PersistenceError",
      code: "unauthorized",
    });
  });
});
<exited with exit code 0>
```

</details>


---

<sub>⏱️ 49s</sub>

### ✅ `bash`

**List migration files**

$ cd /home/azureuser/ai-prompt-pro && ls supabase/migrations/

```
20260209000000_initial_schema.sql  20260209001000_hardening_persistence.sql
<exited with exit code 0>
```


---

<sub>⏱️ 51s</sub>

### 💬 Copilot

Now let me check the remaining diff and the migration files, then run tests and build.

---

<sub>⏱️ 56s</sub>

### ✅ `bash`

**Read migration files**

$ cd /home/azureuser/ai-prompt-pro && cat supabase/migrations/20260209000000_initial_schema.sql supabase/migrations/20260209001000_hardening_persistence.sql

<details>
<summary>161 lines</summary>

```
-- ============================================================
-- Initial schema: profiles, drafts, templates, prompt_versions
-- ============================================================

-- 1. profiles — auto-created on signup via trigger
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. drafts — one active draft per user (upsert-friendly)
create table public.drafts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  config     jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  constraint drafts_user_id_unique unique (user_id)
);

alter table public.drafts enable row level security;

create policy "Users can read own draft"
  on public.drafts for select
  using (auth.uid() = user_id);

create policy "Users can insert own draft"
  on public.drafts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own draft"
  on public.drafts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own draft"
  on public.drafts for delete
  using (auth.uid() = user_id);

-- 3. templates — saved presets per user
create table public.templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  name        text not null,
  description text not null default '',
  tags        text[] not null default '{}',
  config      jsonb not null default '{}',
  fingerprint text,
  revision    int not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint templates_user_name_unique unique (user_id, name)
);

alter table public.templates enable row level security;

create policy "Users can read own templates"
  on public.templates for select
  using (auth.uid() = user_id);

create policy "Users can insert own templates"
  on public.templates for insert
  with check (auth.uid() = user_id);

create policy "Users can update own templates"
  on public.templates for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own templates"
  on public.templates for delete
  using (auth.uid() = user_id);

create index templates_user_id_idx on public.templates (user_id);
create index templates_updated_at_idx on public.templates (updated_at desc);

-- 4. prompt_versions — saved prompt snapshots
create table public.prompt_versions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  name       text not null,
  prompt     text not null,
  created_at timestamptz not null default now()
);

alter table public.prompt_versions enable row level security;

create policy "Users can read own versions"
  on public.prompt_versions for select
  using (auth.uid() = user_id);

create policy "Users can insert own versions"
  on public.prompt_versions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own versions"
  on public.prompt_versions for delete
  using (auth.uid() = user_id);

create index prompt_versions_user_id_idx on public.prompt_versions (user_id);
create index prompt_versions_created_at_idx on public.prompt_versions (created_at desc);
-- ============================================================
-- Persistence hardening: case-insensitive template names,
-- updated_at consistency triggers, and query-friendly indexes.
-- ============================================================

-- Keep updated_at correct even when writes do not explicitly set it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_drafts_updated_at on public.drafts;
create trigger set_drafts_updated_at
before update on public.drafts
for each row execute function public.set_updated_at();

drop trigger if exists set_templates_updated_at on public.templates;
create trigger set_templates_updated_at
before update on public.templates
for each row execute function public.set_updated_at();

-- Ensure template names are unique per user regardless of casing.
with ranked_templates as (
  select
    id,
    row_number() over (
      partition by user_id, lower(name)
      order by updated_at desc, created_at desc, id desc
    ) as duplicate_rank
  from public.templates
)
delete from public.templates as templates
using ranked_templates
where templates.id = ranked_templates.id
  and ranked_templates.duplicate_rank > 1;

alter table public.templates
  drop constraint if exists templates_user_name_unique;

drop index if exists public.templates_user_name_unique_ci;
create unique index templates_user_name_unique_ci
  on public.templates (user_id, lower(name));

-- Match filter+sort query pattern used by the app.
create index if not exists templates_user_updated_at_idx
  on public.templates (user_id, updated_at desc);

create index if not exists prompt_versions_user_created_at_idx
  on public.prompt_versions (user_id, created_at desc);
<exited with exit code 0>
```

</details>


---

<sub>⏱️ 56s</sub>

### ✅ `bash`

**Check remaining Index.tsx diff**

$ cd /home/azureuser/ai-prompt-pro && git --no-pager diff -- src/pages/Index.tsx | tail -40

<details>
<summary>39 lines</summary>

```
-      });
     },
     [loadSavedTemplate, toast]
   );
 
   const handleDeleteSavedTemplate = useCallback(
-    (id: string) => {
-      const deleted = deleteSavedTemplate(id);
-      if (!deleted) {
-        toast({ title: "Preset not found", variant: "destructive" });
-        return;
+    async (id: string) => {
+      try {
+        const deleted = await deleteSavedTemplate(id);
+        if (!deleted) {
+          toast({ title: "Preset not found", variant: "destructive" });
+          return;
+        }
+        toast({ title: "Saved preset deleted" });
+      } catch (error) {
+        toast({
+          title: "Failed to delete preset",
+          description: error instanceof Error ? error.message : "Unexpected error",
+          variant: "destructive",
+        });
       }
-      toast({ title: "Saved preset deleted" });
     },
     [deleteSavedTemplate, toast]
   );
 
   const handleSaveAsTemplate = useCallback(
-    (input: { name: string; description?: string; tags?: string[] }) => {
+    async (input: { name: string; description?: string; tags?: string[] }) => {
       try {
-        const result = saveAsTemplate(input);
+        const result = await saveAsTemplate(input);
         const warningText =
           result.warnings.length > 0
             ? ` ${result.warnings.length} validation warning(s) were recorded.`
<exited with exit code 0>
```

</details>


---

<sub>⏱️ 56s</sub>

### ✅ `bash`

**Run TypeScript type check**

$ cd /home/azureuser/ai-prompt-pro && npx tsc --noEmit 2>&1 | head -80

```

<exited with exit code 0>
```


---

<sub>⏱️ 58s</sub>

### 💬 Copilot

TypeScript compiles clean. Let me run the tests now.

---

<sub>⏱️ 1m 1s</sub>

### ✅ `bash`

**Run vitest tests**

$ cd /home/azureuser/ai-prompt-pro && npx vitest run 2>&1 | tail -40

<details>
<summary>11 lines</summary>

```
RUN  v3.2.4 /home/azureuser/ai-prompt-pro

 ✓ src/test/example.test.ts (1 test) 2ms
 ✓ src/test/text-diff.test.ts (3 tests) 3ms
 ✓ src/test/section-health.test.ts (4 tests) 3ms
 ✓ src/test/persistence.test.ts (3 tests) 35ms
 ✓ src/test/template-store.test.ts (4 tests) 14ms

 Test Files  5 passed (5)
      Tests  15 passed (15)
   Start at  21:47:40
   Duration  727ms (transform 134ms, setup 195ms, collect 222ms, tests 57ms, environment 1.30s, prepare 1.00s)
<exited with exit code 0>
```

</details>


---

<sub>⏱️ 1m 2s</sub>

### 💬 Copilot

Now let me perform a deeper code review of the changes.

---

<sub>⏱️ 1m 14s</sub>

### 📦 task (Completed)

### 💬 Copilot

I'll review the uncommitted changes for bugs, security issues, and logic errors. Let me start by examining what's been changed.

### ✅ `bash`

**Check git status**

$ cd /home/azureuser/ai-prompt-pro && git --no-pager status

<details>
<summary>24 lines</summary>

```
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   .codex/index/graph.json
	modified:   .codex/index/meta.json
	modified:   .codex/index/vectors.db
	modified:   .gitignore
	modified:   src/App.tsx
	modified:   src/components/Header.tsx
	modified:   src/hooks/usePromptBuilder.ts
	modified:   src/integrations/supabase/types.ts
	modified:   src/lib/template-store.ts
	modified:   src/pages/Index.tsx

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	src/components/AuthDialog.tsx
	src/hooks/useAuth.tsx
	src/lib/persistence.ts
	src/test/persistence.test.ts
	supabase/migrations/

no changes added to commit (use "git add" and/or "git commit -a")
<exited with exit code 0>
```

</details>


### ✅ `bash`

**Review usePromptBuilder changes**

$ cd /home/azureuser/ai-prompt-pro && git --no-pager diff src/hooks/usePromptBuilder.ts

<details>
<summary>458 lines</summary>

```diff
diff --git a/src/hooks/usePromptBuilder.ts b/src/hooks/usePromptBuilder.ts
index 1e3c2c0..b05e475 100644
--- a/src/hooks/usePromptBuilder.ts
+++ b/src/hooks/usePromptBuilder.ts
@@ -1,4 +1,4 @@
-import { useState, useCallback, useEffect } from "react";
+import { useState, useCallback, useEffect, useRef } from "react";
 import { PromptConfig, defaultConfig, buildPrompt, scorePrompt } from "@/lib/prompt-builder";
 import type {
   ContextSource,
@@ -9,16 +9,17 @@ import type {
 } from "@/lib/context-types";
 import { defaultContextConfig } from "@/lib/context-types";
 import {
-  deleteTemplateById,
-  listTemplateSummaries,
-  loadTemplateById,
-  saveTemplateSnapshot,
+  listTemplateSummaries as listLocalTemplateSummaries,
   type SaveTemplateResult,
   type TemplateLoadResult,
   type TemplateSummary,
 } from "@/lib/template-store";
+import { useAuth } from "@/hooks/useAuth";
+import { useToast } from "@/hooks/use-toast";
+import * as persistence from "@/lib/persistence";
 
 const STORAGE_KEY = "promptforge-draft";
+const DRAFT_AUTOSAVE_DELAY_MS = 700;
 
 function hydrateConfig(raw: unknown): PromptConfig {
   if (!raw || typeof raw !== "object") return defaultConfig;
@@ -53,46 +54,179 @@ function hydrateConfig(raw: unknown): PromptConfig {
   };
 }
 
-export function usePromptBuilder() {
-  const [config, setConfig] = useState<PromptConfig>(() => {
-    try {
-      const saved = localStorage.getItem(STORAGE_KEY);
-      return saved ? hydrateConfig(JSON.parse(saved)) : defaultConfig;
-    } catch {
-      return defaultConfig;
-    }
-  });
+function loadLocalDraft(): PromptConfig {
+  try {
+    const saved = localStorage.getItem(STORAGE_KEY);
+    return saved ? hydrateConfig(JSON.parse(saved)) : defaultConfig;
+  } catch {
+    return defaultConfig;
+  }
+}
 
+export function usePromptBuilder() {
+  const { user } = useAuth();
+  const { toast } = useToast();
+  const userId = user?.id ?? null;
+  const [config, setConfig] = useState<PromptConfig>(loadLocalDraft);
   const [enhancedPrompt, setEnhancedPrompt] = useState("");
   const [isEnhancing, setIsEnhancing] = useState(false);
-  const [versions, setVersions] = useState<{ id: string; name: string; prompt: string; timestamp: number }[]>([]);
-  const [templateSummaries, setTemplateSummaries] = useState<TemplateSummary[]>(() => listTemplateSummaries());
+  const [versions, setVersions] = useState<persistence.PromptVersion[]>([]);
+  const [templateSummaries, setTemplateSummaries] = useState<TemplateSummary[]>(() =>
+    listLocalTemplateSummaries(),
+  );
+  const [isDraftDirty, setIsDraftDirty] = useState(false);
+  const [isCloudHydrated, setIsCloudHydrated] = useState(false);
+
+  const prevUserId = useRef<string | null>(null);
+  const draftSaveError = useRef<string | null>(null);
+  const authLoadToken = useRef(0);
+  const autosaveToken = useRef(0);
+  const editsSinceAuthChange = useRef(false);
 
-  const refreshTemplateSummaries = useCallback(() => {
-    setTemplateSummaries(listTemplateSummaries());
+  const showPersistenceError = useCallback(
+    (title: string, error: unknown, fallback: string) => {
+      toast({
+        title,
+        description: persistence.getPersistenceErrorMessage(error, fallback),
+        variant: "destructive",
+      });
+    },
+    [toast],
+  );
+
+  const markDraftDirty = useCallback(() => {
+    editsSinceAuthChange.current = true;
+    setIsDraftDirty(true);
   }, []);
 
-  // Auto-save
+  // Load draft/templates/versions when the auth identity changes.
   useEffect(() => {
-    const timeout = setTimeout(() => {
+    if (userId === prevUserId.current) return;
+    prevUserId.current = userId;
+    draftSaveError.current = null;
+    editsSinceAuthChange.current = false;
+    setIsDraftDirty(false);
+
+    const token = ++authLoadToken.current;
+
+    if (!userId) {
+      setIsCloudHydrated(true);
+      setConfig(loadLocalDraft());
+      setTemplateSummaries(listLocalTemplateSummaries());
+      setVersions([]);
+      return;
+    }
+
+    setIsCloudHydrated(false);
+
+    void Promise.allSettled([
+      persistence.loadDraft(userId),
+      persistence.loadTemplates(userId),
+      persistence.loadVersions(userId),
+    ]).then(([draftResult, templatesResult, versionsResult]) => {
+      if (token !== authLoadToken.current) return;
+
+      if (draftResult.status === "fulfilled") {
+        if (draftResult.value && !editsSinceAuthChange.current) {
+          setConfig(hydrateConfig(draftResult.value));
+        }
+      } else {
+        showPersistenceError("Failed to load draft", draftResult.reason, "Failed to load draft.");
+      }
+
+      if (templatesResult.status === "fulfilled") {
+        setTemplateSummaries(templatesResult.value);
+      } else {
+        setTemplateSummaries([]);
+        showPersistenceError("Failed to load presets", templatesResult.reason, "Failed to load presets.");
+      }
+
+      if (versionsResult.status === "fulfilled") {
+        setVersions(versionsResult.value);
+      } else {
+        setVersions([]);
+        showPersistenceError(
+          "Failed to load version history",
+          versionsResult.reason,
+          "Failed to load version history.",
+        );
+      }
+
+      setIsCloudHydrated(true);
+      if (!editsSinceAuthChange.current) {
+        setIsDraftDirty(false);
+      }
+    });
+  }, [userId, showPersistenceError]);
+
+  const refreshTemplateSummaries = useCallback(async () => {
+    if (userId) {
+      try {
+        const summaries = await persistence.loadTemplates(userId);
+        setTemplateSummaries(summaries);
+      } catch (error) {
+        showPersistenceError("Failed to refresh presets", error, "Failed to refresh presets.");
+      }
+    } else {
+      setTemplateSummaries(listLocalTemplateSummaries());
+    }
+  }, [userId, showPersistenceError]);
+
+  const saveDraftSafely = useCallback(
+    async (nextConfig: PromptConfig, saveToken: number) => {
       try {
-        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
-      } catch {
-        // Ignore quota errors to avoid runtime crashes.
+        await persistence.saveDraft(userId, nextConfig);
+        draftSaveError.current = null;
+        if (saveToken === autosaveToken.current) {
+          setIsDraftDirty(false);
+        }
+      } catch (error) {
+        const message = persistence.getPersistenceErrorMessage(error, "Failed to save draft.");
+        if (draftSaveError.current !== message) {
+          draftSaveError.current = message;
+          toast({
+            title: "Draft auto-save failed",
+            description: message,
+            variant: "destructive",
+          });
+        }
       }
-    }, 500);
+    },
+    [userId, toast],
+  );
+
+  // Auto-save draft (debounced)
+  useEffect(() => {
+    if (!isDraftDirty) return;
+    if (userId && !isCloudHydrated) return;
+
+    const saveToken = ++autosaveToken.current;
+    const timeout = setTimeout(() => {
+      void saveDraftSafely(config, saveToken);
+    }, DRAFT_AUTOSAVE_DELAY_MS);
+
     return () => clearTimeout(timeout);
-  }, [config]);
+  }, [config, isDraftDirty, userId, isCloudHydrated, saveDraftSafely]);
 
-  const updateConfig = useCallback((updates: Partial<PromptConfig>) => {
-    setConfig((prev) => ({ ...prev, ...updates }));
-  }, []);
+  const updateConfig = useCallback(
+    (updates: Partial<PromptConfig>) => {
+      setConfig((prev) => ({ ...prev, ...updates }));
+      markDraftDirty();
+    },
+    [markDraftDirty],
+  );
 
   const resetConfig = useCallback(() => {
     setConfig(defaultConfig);
     setEnhancedPrompt("");
-    localStorage.removeItem(STORAGE_KEY);
-  }, []);
+    if (!userId) {
+      persistence.clearLocalDraft();
+      setIsDraftDirty(false);
+      editsSinceAuthChange.current = false;
+      return;
+    }
+    markDraftDirty();
+  }, [userId, markDraftDirty]);
 
   const clearOriginalPrompt = useCallback(() => {
     setConfig((prev) => ({
@@ -100,63 +234,92 @@ export function usePromptBuilder() {
       originalPrompt: "",
     }));
     setEnhancedPrompt("");
-  }, []);
+    markDraftDirty();
+  }, [markDraftDirty]);
 
   // Context-specific updaters
-  const updateContextSources = useCallback((sources: ContextSource[]) => {
-    setConfig((prev) => ({
-      ...prev,
-      contextConfig: { ...prev.contextConfig, sources },
-    }));
-  }, []);
+  const updateContextSources = useCallback(
+    (sources: ContextSource[]) => {
+      setConfig((prev) => ({
+        ...prev,
+        contextConfig: { ...prev.contextConfig, sources },
+      }));
+      markDraftDirty();
+    },
+    [markDraftDirty],
+  );
 
-  const updateDatabaseConnections = useCallback((databaseConnections: DatabaseConnection[]) => {
-    setConfig((prev) => ({
-      ...prev,
-      contextConfig: { ...prev.contextConfig, databaseConnections },
-    }));
-  }, []);
+  const updateDatabaseConnections = useCallback(
+    (databaseConnections: DatabaseConnection[]) => {
+      setConfig((prev) => ({
+        ...prev,
+        contextConfig: { ...prev.contextConfig, databaseConnections },
+      }));
+      markDraftDirty();
+    },
+    [markDraftDirty],
+  );
 
-  const updateRagParameters = useCallback((ragUpdates: Partial<RagParameters>) => {
-    setConfig((prev) => ({
-      ...prev,
-      contextConfig: {
-        ...prev.contextConfig,
-        rag: { ...prev.contextConfig.rag, ...ragUpdates },
-      },
-    }));
-  }, []);
+  const updateRagParameters = useCallback(
+    (ragUpdates: Partial<RagParameters>) => {
+      setConfig((prev) => ({
+        ...prev,
+        contextConfig: {
+          ...prev.contextConfig,
+          rag: { ...prev.contextConfig.rag, ...ragUpdates },
+        },
+      }));
+      markDraftDirty();
+    },
+    [markDraftDirty],
+  );
 
-  const updateContextStructured = useCallback((updates: Partial<StructuredContext>) => {
-    setConfig((prev) => ({
-      ...prev,
-      contextConfig: {
-        ...prev.contextConfig,
-        structured: { ...prev.contextConfig.structured, ...updates },
-      },
-    }));
-  }, []);
+  const updateContextStructured = useCallback(
+    (updates: Partial<StructuredContext>) => {
+      setConfig((prev) => ({
+        ...prev,
+        contextConfig: {
+          ...prev.contextConfig,
+          structured: { ...prev.contextConfig.structured, ...updates },
+        },
+      }));
+      markDraftDirty();
+    },
+    [markDraftDirty],
+  );
 
-  const updateContextInterview = useCallback((answers: InterviewAnswer[]) => {
-    setConfig((prev) => ({
-      ...prev,
-      contextConfig: { ...prev.contextConfig, interviewAnswers: answers },
-    }));
-  }, []);
+  const updateContextInterview = useCallback(
+    (answers: InterviewAnswer[]) => {
+      setConfig((prev) => ({
+        ...prev,
+        contextConfig: { ...prev.contextConfig, interviewAnswers: answers },
+      }));
+      markDraftDirty();
+    },
+    [markDraftDirty],
+  );
 
-  const updateProjectNotes = useCallback((notes: string) => {
-    setConfig((prev) => ({
-      ...prev,
-      contextConfig: { ...prev.contextConfig, projectNotes: notes },
-    }));
-  }, []);
+  const updateProjectNotes = useCallback(
+    (notes: string) => {
+      setConfig((prev) => ({
+        ...prev,
+        contextConfig: { ...prev.contextConfig, projectNotes: notes },
+      }));
+      markDraftDirty();
+    },
+    [markDraftDirty],
+  );
 
-  const toggleDelimiters = useCallback((value: boolean) => {
-    setConfig((prev) => ({
-      ...prev,
-      contextConfig: { ...prev.contextConfig, useDelimiters: value },
-    }));
-  }, []);
+  const toggleDelimiters = useCallback(
+    (value: boolean) => {
+      setConfig((prev) => ({
+        ...prev,
+        contextConfig: { ...prev.contextConfig, useDelimiters: value },
+      }));
+      markDraftDirty();
+    },
+    [markDraftDirty],
+  );
 
   const builtPrompt = buildPrompt(config);
   const score = scorePrompt(config);
@@ -165,15 +328,28 @@ export function usePromptBuilder() {
     (name?: string) => {
       const promptToSave = enhancedPrompt || builtPrompt;
       if (!promptToSave) return;
-      const version = {
-        id: Date.now().toString(),
-        name: name || `Version ${versions.length + 1}`,
-        prompt: promptToSave,
-        timestamp: Date.now(),
-      };
-      setVersions((prev) => [version, ...prev]);
+      const versionName = name || `Version ${versions.length + 1}`;
+
+      if (userId) {
+        void persistence
+          .saveVersion(userId, versionName, promptToSave)
+          .then((saved) => {
+            if (saved) setVersions((prev) => [saved, ...prev]);
+          })
+          .catch((error) => {
+            showPersistenceError("Failed to save version", error, "Failed to save version.");
+          });
+      } else {
+        const version: persistence.PromptVersion = {
+          id: Date.now().toString(),
+          name: versionName,
+          prompt: promptToSave,
+          timestamp: Date.now(),
+        };
+        setVersions((prev) => [version, ...prev]);
+      }
     },
-    [enhancedPrompt, builtPrompt, versions.length]
+    [enhancedPrompt, builtPrompt, versions.length, userId, showPersistenceError],
   );
 
   const loadTemplate = useCallback(
@@ -201,37 +377,43 @@ export function usePromptBuilder() {
         examples: template.examples,
       });
       setEnhancedPrompt("");
+      markDraftDirty();
     },
-    []
+    [markDraftDirty],
   );
 
   const saveAsTemplate = useCallback(
-    (input: { name: string; description?: string; tags?: string[] }): SaveTemplateResult => {
-      const result = saveTemplateSnapshot({
-        ...input,
-        config,
-      });
-      refreshTemplateSummaries();
+    async (input: {
+      name: string;
+      description?: string;
+      tags?: string[];
+    }): Promise<SaveTemplateResult> => {
+      const result = await persistence.saveTemplate(userId, { ...input, config });
+      await refreshTemplateSummaries();
       return result;
     },
-    [config, refreshTemplateSummaries]
+    [config, userId, refreshTemplateSummaries],
   );
 
-  const loadSavedTemplate = useCallback((id: string): TemplateLoadResult | null => {
-    const loaded = loadTemplateById(id);
-    if (!loaded) return null;
-    setConfig(hydrateConfig(loaded.record.state.promptConfig));
-    setEnhancedPrompt("");
-    return loaded;
-  }, []);
+  const loadSavedTemplate = useCallback(
+    async (id: string): Promise<TemplateLoadResult | null> => {
+      const loaded = await persistence.loadTemplateById(userId, id);
+      if (!loaded) return null;
+      setConfig(hydrateConfig(loaded.record.state.promptConfig));
+      setEnhancedPrompt("");
+      markDraftDirty();
+      return loaded;
+    },
+    [userId, markDraftDirty],
+  );
 
   const deleteSavedTemplate = useCallback(
-    (id: string): boolean => {
-      const deleted = deleteTemplateById(id);
-      if (deleted) refreshTemplateSummaries();
+    async (id: string): Promise<boolean> => {
+      const deleted = await persistence.deleteTemplate(userId, id);
+      if (deleted) await refreshTemplateSummaries();
       return deleted;
     },
-    [refreshTemplateSummaries]
+    [userId, refreshTemplateSummaries],
   );
 
   return {
<exited with exit code 0>
```

</details>


### ✅ `bash`

**Review App.tsx changes**

$ cd /home/azureuser/ai-prompt-pro && git --no-pager diff src/App.tsx

<details>
<summary>41 lines</summary>

```diff
diff --git a/src/App.tsx b/src/App.tsx
index 18daf2e..78aed79 100644
--- a/src/App.tsx
+++ b/src/App.tsx
@@ -3,6 +3,7 @@ import { Toaster as Sonner } from "@/components/ui/sonner";
 import { TooltipProvider } from "@/components/ui/tooltip";
 import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
 import { BrowserRouter, Routes, Route } from "react-router-dom";
+import { AuthProvider } from "@/hooks/useAuth";
 import Index from "./pages/Index";
 import NotFound from "./pages/NotFound";
 
@@ -10,17 +11,19 @@ const queryClient = new QueryClient();
 
 const App = () => (
   <QueryClientProvider client={queryClient}>
-    <TooltipProvider>
-      <Toaster />
-      <Sonner />
-      <BrowserRouter>
-        <Routes>
-          <Route path="/" element={<Index />} />
-          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
-          <Route path="*" element={<NotFound />} />
-        </Routes>
-      </BrowserRouter>
-    </TooltipProvider>
+    <AuthProvider>
+      <TooltipProvider>
+        <Toaster />
+        <Sonner />
+        <BrowserRouter>
+          <Routes>
+            <Route path="/" element={<Index />} />
+            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
+            <Route path="*" element={<NotFound />} />
+          </Routes>
+        </BrowserRouter>
+      </TooltipProvider>
+    </AuthProvider>
   </QueryClientProvider>
 );
<exited with exit code 0>
```

</details>


### ✅ `bash`

**Review Index.tsx changes**

$ cd /home/azureuser/ai-prompt-pro && git --no-pager diff src/pages/Index.tsx

<details>
<summary>78 lines</summary>

```diff
diff --git a/src/pages/Index.tsx b/src/pages/Index.tsx
index 722aba4..cdfb38f 100644
--- a/src/pages/Index.tsx
+++ b/src/pages/Index.tsx
@@ -198,39 +198,55 @@ const Index = () => {
   );
 
   const handleSelectSavedTemplate = useCallback(
-    (id: string) => {
-      const loaded = loadSavedTemplate(id);
-      if (!loaded) {
-        toast({ title: "Preset not found", variant: "destructive" });
-        return;
+    async (id: string) => {
+      try {
+        const loaded = await loadSavedTemplate(id);
+        if (!loaded) {
+          toast({ title: "Preset not found", variant: "destructive" });
+          return;
+        }
+        toast({
+          title: `Preset loaded: ${loaded.record.metadata.name}`,
+          description:
+            loaded.warnings.length > 0
+              ? `${loaded.warnings.length} context warning(s). Review integrations before running.`
+              : "Preset restored successfully.",
+        });
+      } catch (error) {
+        toast({
+          title: "Failed to load preset",
+          description: error instanceof Error ? error.message : "Unexpected error",
+          variant: "destructive",
+        });
       }
-      toast({
-        title: `Preset loaded: ${loaded.record.metadata.name}`,
-        description:
-          loaded.warnings.length > 0
-            ? `${loaded.warnings.length} context warning(s). Review integrations before running.`
-            : "Preset restored successfully.",
-      });
     },
     [loadSavedTemplate, toast]
   );
 
   const handleDeleteSavedTemplate = useCallback(
-    (id: string) => {
-      const deleted = deleteSavedTemplate(id);
-      if (!deleted) {
-        toast({ title: "Preset not found", variant: "destructive" });
-        return;
+    async (id: string) => {
+      try {
+        const deleted = await deleteSavedTemplate(id);
+        if (!deleted) {
+          toast({ title: "Preset not found", variant: "destructive" });
+          return;
+        }
+        toast({ title: "Saved preset deleted" });
+      } catch (error) {
+        toast({
+          title: "Failed to delete preset",
+          description: error instanceof Error ? error.message : "Unexpected error",
+          variant: "destructive",
+        });
       }
-      toast({ title: "Saved preset deleted" });
     },
     [deleteSavedTemplate, toast]
   );
 
   const handleSaveAsTemplate = useCallback(
-    (input: { name: string; description?: string; tags?: string[] }) => {
+    async (input: { name: string; description?: string; tags?: string[] }) => {
       try {
-        const result = saveAsTemplate(input);
+        const result = await saveAsTemplate(input);
         const warningText =
           result.warnings.length > 0
             ? ` ${result.warnings.length} validation warning(s) were recorded.`
<exited with exit code 0>
```

</details>


### ✅ `view`

**view the file at /home/azureuser/ai-prompt-pro/src/lib/persistence.ts.**

/home/azureuser/ai-prompt-pro/src/lib/persistence.ts

<details>
<summary>414 lines</summary>

```
1. import type { PostgrestError } from "@supabase/supabase-js";
2. import { supabase } from "@/integrations/supabase/client";
3. import type { Json } from "@/integrations/supabase/types";
4. import type { PromptConfig } from "@/lib/prompt-builder";
5. import { defaultConfig } from "@/lib/prompt-builder";
6. import {
7.   collectTemplateWarnings,
8.   computeTemplateFingerprint,
9.   inferTemplateStarterPrompt,
10.   listTemplateSummaries as listLocalTemplates,
11.   loadTemplateById as loadLocalTemplate,
12.   normalizeTemplateConfig,
13.   saveTemplateSnapshot as saveLocalTemplate,
14.   deleteTemplateById as deleteLocalTemplate,
15.   type TemplateSummary,
16.   type TemplateLoadResult,
17.   type SaveTemplateResult,
18.   type TemplateSaveInput,
19. } from "@/lib/template-store";
20. 
21. const DRAFT_KEY = "promptforge-draft";
22. const TEMPLATE_SELECT_COLUMNS =
23.   "id, name, description, tags, config, fingerprint, revision, created_at, updated_at";
24. 
25. type PersistenceErrorCode = "unauthorized" | "conflict" | "network" | "unknown";
26. 
27. export class PersistenceError extends Error {
28.   readonly code: PersistenceErrorCode;
29. 
30.   constructor(code: PersistenceErrorCode, message: string, options?: { cause?: unknown }) {
31.     super(message, options);
32.     this.name = "PersistenceError";
33.     this.code = code;
34.   }
35. }
36. 
37. export function getPersistenceErrorMessage(error: unknown, fallback: string): string {
38.   if (error instanceof Error && error.message.trim()) return error.message;
39.   return fallback;
40. }
41. 
42. function isPostgrestError(value: unknown): value is PostgrestError {
43.   if (!value || typeof value !== "object") return false;
44.   const candidate = value as Record<string, unknown>;
45.   return typeof candidate.message === "string" && typeof candidate.code === "string";
46. }
47. 
48. function mapPostgrestError(error: PostgrestError, fallback: string): PersistenceError {
49.   const message = (error.message || fallback).trim() || fallback;
50.   const isUnauthorized =
51.     error.code === "42501" ||
52.     /row-level security|permission denied|insufficient privilege|not authenticated|jwt/i.test(message);
53. 
54.   if (isUnauthorized) {
55.     return new PersistenceError("unauthorized", message, { cause: error });
56.   }
57. 
58.   if (error.code === "23505") {
59.     return new PersistenceError("conflict", message, { cause: error });
60.   }
61. 
62.   return new PersistenceError("unknown", message, { cause: error });
63. }
64. 
65. function toPersistenceError(error: unknown, fallback: string): PersistenceError {
66.   if (error instanceof PersistenceError) return error;
67.   if (isPostgrestError(error)) return mapPostgrestError(error, fallback);
68.   if (error instanceof Error) {
69.     if (/network|failed to fetch|fetch failed|connection/i.test(error.message)) {
70.       return new PersistenceError("network", error.message, { cause: error });
71.     }
72.     return new PersistenceError("unknown", error.message || fallback, { cause: error });
73.   }
74.   return new PersistenceError("unknown", fallback, { cause: error });
75. }
76. 
77. function normalizeTags(tags?: string[]): string[] | undefined {
78.   if (!Array.isArray(tags)) return undefined;
79.   return tags.map((tag) => tag.trim()).filter(Boolean);
80. }
81. 
82. type TemplateRow = {
83.   id: string;
84.   name: string;
85.   description: string;
86.   tags: string[] | null;
87.   config: Json | null;
88.   fingerprint: string | null;
89.   revision: number;
90.   created_at: string;
91.   updated_at: string;
92. };
93. 
94. // ---------------------------------------------------------------------------
95. // Draft persistence
96. // ---------------------------------------------------------------------------
97. 
98. export async function loadDraft(userId: string | null): Promise<PromptConfig | null> {
99.   if (!userId) {
100.     try {
101.       const raw = localStorage.getItem(DRAFT_KEY);
102.       return raw ? (JSON.parse(raw) as PromptConfig) : null;
103.     } catch {
104.       return null;
105.     }
106.   }
107. 
108.   try {
109.     const { data, error } = await supabase
110.       .from("drafts")
111.       .select("config")
112.       .eq("user_id", userId)
113.       .maybeSingle();
114. 
115.     if (error) throw mapPostgrestError(error, "Failed to load cloud draft.");
116.     if (!data) return null;
117.     return data.config as unknown as PromptConfig;
118.   } catch (error) {
119.     throw toPersistenceError(error, "Failed to load cloud draft.");
120.   }
121. }
122. 
123. export async function saveDraft(userId: string | null, config: PromptConfig): Promise<void> {
124.   if (!userId) {
125.     try {
126.       localStorage.setItem(DRAFT_KEY, JSON.stringify(config));
127.     } catch {
128.       // quota errors are intentionally ignored to keep the UI responsive
129.     }
130.     return;
131.   }
132. 
133.   try {
134.     const { error } = await supabase.from("drafts").upsert(
135.       {
136.         user_id: userId,
137.         config: config as unknown as Json,
138.       },
139.       { onConflict: "user_id" },
140.     );
141.     if (error) throw mapPostgrestError(error, "Failed to save cloud draft.");
142.   } catch (error) {
143.     throw toPersistenceError(error, "Failed to save cloud draft.");
144.   }
145. }
146. 
147. export function clearLocalDraft(): void {
148.   try {
149.     localStorage.removeItem(DRAFT_KEY);
150.   } catch {
151.     // ignore
152.   }
153. }
154. 
155. // ---------------------------------------------------------------------------
156. // Template / Preset persistence
157. // ---------------------------------------------------------------------------
158. 
159. export async function loadTemplates(userId: string | null): Promise<TemplateSummary[]> {
160.   if (!userId) return listLocalTemplates();
161. 
162.   try {
163.     const { data, error } = await supabase
164.       .from("templates")
165.       .select(TEMPLATE_SELECT_COLUMNS)
166.       .eq("user_id", userId)
167.       .order("updated_at", { ascending: false });
168. 
169.     if (error) throw mapPostgrestError(error, "Failed to load presets.");
170.     if (!data) return [];
171. 
172.     return data.map((row) => {
173.       const cfg = normalizeTemplateConfig((row.config ?? defaultConfig) as unknown as PromptConfig);
174.       return {
175.         id: row.id,
176.         name: row.name,
177.         description: row.description,
178.         tags: row.tags ?? [],
179.         starterPrompt: inferTemplateStarterPrompt(cfg),
180.         updatedAt: new Date(row.updated_at).getTime(),
181.         createdAt: new Date(row.created_at).getTime(),
182.         revision: row.revision,
183.         schemaVersion: 2,
184.         sourceCount: cfg.contextConfig.sources.length,
185.         databaseCount: cfg.contextConfig.databaseConnections.length,
186.         ragEnabled: cfg.contextConfig.rag.enabled,
187.       };
188.     });
189.   } catch (error) {
190.     throw toPersistenceError(error, "Failed to load presets.");
191.   }
192. }
193. 
194. export async function loadTemplateById(
195.   userId: string | null,
196.   id: string,
197. ): Promise<TemplateLoadResult | null> {
198.   if (!userId) return loadLocalTemplate(id);
199. 
200.   try {
201.     const { data, error } = await supabase
202.       .from("templates")
203.       .select(TEMPLATE_SELECT_COLUMNS)
204.       .eq("id", id)
205.       .eq("user_id", userId)
206.       .maybeSingle();
207. 
208.     if (error) throw mapPostgrestError(error, "Failed to load preset.");
209.     if (!data) return null;
210. 
211.     const cfg = normalizeTemplateConfig((data.config ?? defaultConfig) as unknown as PromptConfig);
212.     return {
213.       record: rowToRecord(data, cfg),
214.       warnings: collectTemplateWarnings(cfg),
215.     };
216.   } catch (error) {
217.     throw toPersistenceError(error, "Failed to load preset.");
218.   }
219. }
220. 
221. export async function saveTemplate(
222.   userId: string | null,
223.   input: TemplateSaveInput,
224. ): Promise<SaveTemplateResult> {
225.   if (!userId) return saveLocalTemplate(input);
226. 
227.   const name = input.name.trim();
228.   if (!name) throw new PersistenceError("unknown", "Preset name is required.");
229. 
230.   const normalizedConfig = normalizeTemplateConfig(input.config);
231.   const fingerprint = computeTemplateFingerprint(normalizedConfig);
232.   const warnings = collectTemplateWarnings(normalizedConfig);
233.   const tags = normalizeTags(input.tags);
234. 
235.   try {
236.     const { data: existingRows, error: lookupError } = await supabase
237.       .from("templates")
238.       .select(TEMPLATE_SELECT_COLUMNS)
239.       .eq("user_id", userId)
240.       .ilike("name", name)
241.       .order("updated_at", { ascending: false })
242.       .limit(1);
243. 
244.     if (lookupError) throw mapPostgrestError(lookupError, "Failed to save preset.");
245.     const existing = existingRows?.[0] ?? null;
246. 
247.     if (existing?.fingerprint === fingerprint) {
248.       return {
249.         outcome: "unchanged",
250.         record: rowToRecord(existing, normalizedConfig),
251.         warnings,
252.       };
253.     }
254. 
255.     if (existing) {
256.       const { data: updated, error } = await supabase
257.         .from("templates")
258.         .update({
259.           description: input.description?.trim() || existing.description,
260.           tags: tags ?? existing.tags ?? [],
261.           config: normalizedConfig as unknown as Json,
262.           fingerprint,
263.           revision: existing.revision + 1,
264.         })
265.         .eq("id", existing.id)
266.         .eq("user_id", userId)
267.         .select(TEMPLATE_SELECT_COLUMNS)
268.         .single();
269. 
270.       if (error) throw mapPostgrestError(error, "Failed to update preset.");
271.       if (!updated) throw new PersistenceError("unknown", "Preset update returned no data.");
272.       return {
273.         outcome: "updated",
274.         record: rowToRecord(updated, normalizedConfig),
275.         warnings,
276.       };
277.     }
278. 
279.     const { data: created, error: insertError } = await supabase
280.       .from("templates")
281.       .insert({
282.         user_id: userId,
283.         name,
284.         description: input.description?.trim() || "",
285.         tags: tags ?? [],
286.         config: normalizedConfig as unknown as Json,
287.         fingerprint,
288.       })
289.       .select(TEMPLATE_SELECT_COLUMNS)
290.       .single();
291. 
292.     if (insertError) {
293.       throw mapPostgrestError(insertError, "Failed to save preset.");
294.     }
295.     if (!created) throw new PersistenceError("unknown", "Preset save returned no data.");
296. 
297.     return {
298.       outcome: "created",
299.       record: rowToRecord(created, normalizedConfig),
300.       warnings,
301.     };
302.   } catch (error) {
303.     throw toPersistenceError(error, "Failed to save preset.");
304.   }
305. }
306. 
307. export async function deleteTemplate(userId: string | null, id: string): Promise<boolean> {
308.   if (!userId) return deleteLocalTemplate(id);
309. 
310.   try {
311.     const { data, error } = await supabase
312.       .from("templates")
313.       .delete()
314.       .eq("id", id)
315.       .eq("user_id", userId)
316.       .select("id")
317.       .maybeSingle();
318. 
319.     if (error) throw mapPostgrestError(error, "Failed to delete preset.");
320.     return !!data;
321.   } catch (error) {
322.     throw toPersistenceError(error, "Failed to delete preset.");
323.   }
324. }
325. 
326. // ---------------------------------------------------------------------------
327. // Prompt versions
328. // ---------------------------------------------------------------------------
329. 
330. export interface PromptVersion {
331.   id: string;
332.   name: string;
333.   prompt: string;
334.   timestamp: number;
335. }
336. 
337. export async function loadVersions(userId: string | null): Promise<PromptVersion[]> {
338.   if (!userId) return [];
339. 
340.   try {
341.     const { data, error } = await supabase
342.       .from("prompt_versions")
343.       .select("id, name, prompt, created_at")
344.       .eq("user_id", userId)
345.       .order("created_at", { ascending: false })
346.       .limit(50);
347. 
348.     if (error) throw mapPostgrestError(error, "Failed to load version history.");
349.     if (!data) return [];
350. 
351.     return data.map((row) => ({
352.       id: row.id,
353.       name: row.name,
354.       prompt: row.prompt,
355.       timestamp: new Date(row.created_at).getTime(),
356.     }));
357.   } catch (error) {
358.     throw toPersistenceError(error, "Failed to load version history.");
359.   }
360. }
361. 
362. export async function saveVersion(
363.   userId: string | null,
364.   name: string,
365.   prompt: string,
366. ): Promise<PromptVersion | null> {
367.   if (!userId) return null;
368. 
369.   try {
370.     const { data, error } = await supabase
371.       .from("prompt_versions")
372.       .insert({ user_id: userId, name, prompt })
373.       .select("id, name, prompt, created_at")
374.       .single();
375. 
376.     if (error) throw mapPostgrestError(error, "Failed to save version.");
377.     if (!data) throw new PersistenceError("unknown", "Version save returned no data.");
378. 
379.     return {
380.       id: data.id,
381.       name: data.name,
382.       prompt: data.prompt,
383.       timestamp: new Date(data.created_at).getTime(),
384.     };
385.   } catch (error) {
386.     throw toPersistenceError(error, "Failed to save version.");
387.   }
388. }
389. 
390. // ---------------------------------------------------------------------------
391. // Helpers
392. // ---------------------------------------------------------------------------
393. 
394. function rowToRecord(row: TemplateRow, normalizedConfig?: PromptConfig) {
395.   const cfg = normalizedConfig || normalizeTemplateConfig((row.config ?? defaultConfig) as unknown as PromptConfig);
396.   return {
397.     metadata: {
398.       id: row.id,
399.       name: row.name,
400.       description: row.description,
401.       tags: row.tags ?? [],
402.       schemaVersion: 2,
403.       revision: row.revision,
404.       fingerprint: row.fingerprint ?? "",
405.       createdAt: new Date(row.created_at).getTime(),
406.       updatedAt: new Date(row.updated_at).getTime(),
407.     },
408.     state: {
409.       promptConfig: cfg,
410.       externalReferences: [],
411.     },
412.   };
413. }
414.
```

</details>


### ✅ `view`

**view the file at /home/azureuser/ai-prompt-pro/src/hooks/useAuth.tsx.**

/home/azureuser/ai-prompt-pro/src/hooks/useAuth.tsx

<details>
<summary>94 lines</summary>

```
1. import {
2.   createContext,
3.   useContext,
4.   useEffect,
5.   useState,
6.   useCallback,
7.   type ReactNode,
8. } from "react";
9. import type { User, Session, Provider } from "@supabase/supabase-js";
10. import { supabase } from "@/integrations/supabase/client";
11. 
12. interface AuthContextValue {
13.   user: User | null;
14.   session: Session | null;
15.   loading: boolean;
16.   signUp: (email: string, password: string) => Promise<{ error: string | null }>;
17.   signIn: (email: string, password: string) => Promise<{ error: string | null }>;
18.   signInWithOAuth: (provider: Provider) => Promise<{ error: string | null }>;
19.   signOut: () => Promise<void>;
20. }
21. 
22. const AuthContext = createContext<AuthContextValue | null>(null);
23. 
24. export function AuthProvider({ children }: { children: ReactNode }) {
25.   const [user, setUser] = useState<User | null>(null);
26.   const [session, setSession] = useState<Session | null>(null);
27.   const [loading, setLoading] = useState(true);
28. 
29.   useEffect(() => {
30.     // Get initial session
31.     supabase.auth.getSession().then(({ data: { session: s } }) => {
32.       // Ignore anonymous sessions — treat them as unauthenticated
33.       if (s?.user?.is_anonymous) {
34.         setSession(null);
35.         setUser(null);
36.       } else {
37.         setSession(s);
38.         setUser(s?.user ?? null);
39.       }
40.       setLoading(false);
41.     });
42. 
43.     const {
44.       data: { subscription },
45.     } = supabase.auth.onAuthStateChange((_event, s) => {
46.       if (s?.user?.is_anonymous) {
47.         setSession(null);
48.         setUser(null);
49.       } else {
50.         setSession(s);
51.         setUser(s?.user ?? null);
52.       }
53.     });
54. 
55.     return () => subscription.unsubscribe();
56.   }, []);
57. 
58.   const signUp = useCallback(async (email: string, password: string) => {
59.     const { error } = await supabase.auth.signUp({ email, password });
60.     return { error: error?.message ?? null };
61.   }, []);
62. 
63.   const signIn = useCallback(async (email: string, password: string) => {
64.     const { error } = await supabase.auth.signInWithPassword({ email, password });
65.     return { error: error?.message ?? null };
66.   }, []);
67. 
68.   const signInWithOAuth = useCallback(async (provider: Provider) => {
69.     const { error } = await supabase.auth.signInWithOAuth({
70.       provider,
71.       options: { redirectTo: window.location.origin },
72.     });
73.     return { error: error?.message ?? null };
74.   }, []);
75. 
76.   const signOut = useCallback(async () => {
77.     await supabase.auth.signOut();
78.   }, []);
79. 
80.   return (
81.     <AuthContext.Provider
82.       value={{ user, session, loading, signUp, signIn, signInWithOAuth, signOut }}
83.     >
84.       {children}
85.     </AuthContext.Provider>
86.   );
87. }
88. 
89. export function useAuth() {
90.   const ctx = useContext(AuthContext);
91.   if (!ctx) throw new Error("useAuth must be used within AuthProvider");
92.   return ctx;
93. }
94.
```

</details>


### 💬 Copilot

Now let me examine the remaining key files and the migration files:

### ✅ `bash`

**Review Header.tsx changes**

$ cd /home/azureuser/ai-prompt-pro && git --no-pager diff src/components/Header.tsx

<details>
<summary>157 lines</summary>

```diff
diff --git a/src/components/Header.tsx b/src/components/Header.tsx
index 7b86476..af9f72f 100644
--- a/src/components/Header.tsx
+++ b/src/components/Header.tsx
@@ -1,5 +1,15 @@
-import { Moon, Sun, Zap, BookOpen, History } from "lucide-react";
+import { useState } from "react";
+import { Moon, Sun, Zap, BookOpen, History, LogIn, LogOut } from "lucide-react";
 import { Button } from "@/components/ui/button";
+import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
+import {
+  DropdownMenu,
+  DropdownMenuContent,
+  DropdownMenuItem,
+  DropdownMenuTrigger,
+} from "@/components/ui/dropdown-menu";
+import { useAuth } from "@/hooks/useAuth";
+import { AuthDialog } from "@/components/AuthDialog";
 
 interface HeaderProps {
   isDark: boolean;
@@ -9,48 +19,98 @@ interface HeaderProps {
 }
 
 export function Header({ isDark, onToggleTheme, onOpenTemplates, onOpenHistory }: HeaderProps) {
+  const { user, signOut } = useAuth();
+  const [authOpen, setAuthOpen] = useState(false);
+
+  const initials = user?.user_metadata?.full_name
+    ? (user.user_metadata.full_name as string)
+        .split(" ")
+        .map((n: string) => n[0])
+        .join("")
+        .slice(0, 2)
+        .toUpperCase()
+    : user?.email
+      ? user.email[0].toUpperCase()
+      : "?";
+
   return (
-    <header className="border-b border-border/80 bg-card/75 backdrop-blur-md sticky top-0 z-50">
-      <div className="container mx-auto flex items-center justify-between h-12 sm:h-14 px-3 sm:px-4">
-        <div className="flex items-center gap-1.5 sm:gap-2">
-          <div className="interactive-chip flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary text-primary-foreground">
-            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
+    <>
+      <header className="border-b border-border/80 bg-card/75 backdrop-blur-md sticky top-0 z-50">
+        <div className="container mx-auto flex items-center justify-between h-12 sm:h-14 px-3 sm:px-4">
+          <div className="flex items-center gap-1.5 sm:gap-2">
+            <div className="interactive-chip flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary text-primary-foreground">
+              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
+            </div>
+            <span className="text-base sm:text-lg font-bold text-foreground tracking-tight">PromptForge</span>
           </div>
-          <span className="text-base sm:text-lg font-bold text-foreground tracking-tight">PromptForge</span>
+
+          <nav className="flex items-center gap-0.5 sm:gap-1">
+            <Button
+              variant="ghost"
+              size="sm"
+              onClick={onOpenTemplates}
+              aria-label="Open presets"
+              className="interactive-chip gap-1.5 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
+            >
+              <BookOpen className="w-4 h-4" />
+              <span className="hidden sm:inline text-sm">Presets</span>
+            </Button>
+            <Button
+              variant="ghost"
+              size="sm"
+              onClick={onOpenHistory}
+              aria-label="Open version history"
+              className="interactive-chip gap-1.5 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
+            >
+              <History className="w-4 h-4" />
+              <span className="hidden sm:inline text-sm">History</span>
+            </Button>
+            <Button
+              variant="ghost"
+              size="icon"
+              onClick={onToggleTheme}
+              aria-label="Toggle theme"
+              className="interactive-chip w-8 h-8 sm:w-9 sm:h-9"
+            >
+              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
+            </Button>
+
+            {user ? (
+              <DropdownMenu>
+                <DropdownMenuTrigger asChild>
+                  <Button variant="ghost" size="icon" className="interactive-chip w-8 h-8 sm:w-9 sm:h-9 rounded-full p-0">
+                    <Avatar className="w-7 h-7 sm:w-8 sm:h-8">
+                      <AvatarImage src={user.user_metadata?.avatar_url as string | undefined} />
+                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
+                    </Avatar>
+                  </Button>
+                </DropdownMenuTrigger>
+                <DropdownMenuContent align="end">
+                  <DropdownMenuItem disabled className="text-xs text-muted-foreground">
+                    {user.email}
+                  </DropdownMenuItem>
+                  <DropdownMenuItem onClick={() => signOut()}>
+                    <LogOut className="w-4 h-4 mr-2" />
+                    Sign out
+                  </DropdownMenuItem>
+                </DropdownMenuContent>
+              </DropdownMenu>
+            ) : (
+              <Button
+                variant="ghost"
+                size="sm"
+                onClick={() => setAuthOpen(true)}
+                className="interactive-chip gap-1.5 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
+              >
+                <LogIn className="w-4 h-4" />
+                <span className="hidden sm:inline text-sm">Sign in</span>
+              </Button>
+            )}
+          </nav>
         </div>
+      </header>
 
-        <nav className="flex items-center gap-0.5 sm:gap-1">
-          <Button
-            variant="ghost"
-            size="sm"
-            onClick={onOpenTemplates}
-            aria-label="Open presets"
-            className="interactive-chip gap-1.5 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
-          >
-            <BookOpen className="w-4 h-4" />
-            <span className="hidden sm:inline text-sm">Presets</span>
-          </Button>
-          <Button
-            variant="ghost"
-            size="sm"
-            onClick={onOpenHistory}
-            aria-label="Open version history"
-            className="interactive-chip gap-1.5 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
-          >
-            <History className="w-4 h-4" />
-            <span className="hidden sm:inline text-sm">History</span>
-          </Button>
-          <Button
-            variant="ghost"
-            size="icon"
-            onClick={onToggleTheme}
-            aria-label="Toggle theme"
-            className="interactive-chip w-8 h-8 sm:w-9 sm:h-9"
-          >
-            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
-          </Button>
-        </nav>
-      </div>
-    </header>
+      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
+    </>
   );
 }
<exited with exit code 0>
```

</details>


### ✅ `view`

**view the file at /home/azureuser/ai-prompt-pro/src/components/AuthDialog.tsx.**

/home/azureuser/ai-prompt-pro/src/components/AuthDialog.tsx

<details>
<summary>197 lines</summary>

```
1. import { useState } from "react";
2. import {
3.   Dialog,
4.   DialogContent,
5.   DialogHeader,
6.   DialogTitle,
7. } from "@/components/ui/dialog";
8. import { Button } from "@/components/ui/button";
9. import { Input } from "@/components/ui/input";
10. import { Label } from "@/components/ui/label";
11. import { useAuth } from "@/hooks/useAuth";
12. import { Loader2 } from "lucide-react";
13. 
14. interface AuthDialogProps {
15.   open: boolean;
16.   onOpenChange: (open: boolean) => void;
17. }
18. 
19. export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
20.   const { signIn, signUp, signInWithOAuth } = useAuth();
21.   const [mode, setMode] = useState<"login" | "signup">("login");
22.   const [email, setEmail] = useState("");
23.   const [password, setPassword] = useState("");
24.   const [error, setError] = useState("");
25.   const [loading, setLoading] = useState(false);
26.   const [confirmationSent, setConfirmationSent] = useState(false);
27. 
28.   const handleSubmit = async (e: React.FormEvent) => {
29.     e.preventDefault();
30.     setError("");
31.     setLoading(true);
32. 
33.     const result =
34.       mode === "login"
35.         ? await signIn(email, password)
36.         : await signUp(email, password);
37. 
38.     setLoading(false);
39. 
40.     if (result.error) {
41.       setError(result.error);
42.       return;
43.     }
44. 
45.     if (mode === "signup") {
46.       setConfirmationSent(true);
47.       return;
48.     }
49. 
50.     // Login succeeded — close
51.     onOpenChange(false);
52.     resetForm();
53.   };
54. 
55.   const handleOAuth = async (provider: "github" | "google") => {
56.     setError("");
57.     const result = await signInWithOAuth(provider);
58.     if (result.error) {
59.       setError(result.error);
60.     }
61.   };
62. 
63.   const resetForm = () => {
64.     setEmail("");
65.     setPassword("");
66.     setError("");
67.     setConfirmationSent(false);
68.   };
69. 
70.   const toggleMode = () => {
71.     setMode(mode === "login" ? "signup" : "login");
72.     setError("");
73.     setConfirmationSent(false);
74.   };
75. 
76.   return (
77.     <Dialog
78.       open={open}
79.       onOpenChange={(v) => {
80.         onOpenChange(v);
81.         if (!v) resetForm();
82.       }}
83.     >
84.       <DialogContent className="sm:max-w-md">
85.         <DialogHeader>
86.           <DialogTitle>
87.             {mode === "login" ? "Sign in" : "Create account"}
88.           </DialogTitle>
89.         </DialogHeader>
90. 
91.         {confirmationSent ? (
92.           <div className="text-center py-4 space-y-2">
93.             <p className="text-sm text-muted-foreground">
94.               Check your email for a confirmation link, then sign in.
95.             </p>
96.             <Button variant="outline" onClick={() => { setMode("login"); setConfirmationSent(false); }}>
97.               Back to sign in
98.             </Button>
99.           </div>
100.         ) : (
101.           <div className="space-y-4">
102.             {/* OAuth buttons */}
103.             <div className="grid grid-cols-2 gap-2">
104.               <Button variant="outline" onClick={() => handleOAuth("github")}>
105.                 <GitHubIcon className="w-4 h-4 mr-2" />
106.                 GitHub
107.               </Button>
108.               <Button variant="outline" onClick={() => handleOAuth("google")}>
109.                 <GoogleIcon className="w-4 h-4 mr-2" />
110.                 Google
111.               </Button>
112.             </div>
113. 
114.             <div className="relative">
115.               <div className="absolute inset-0 flex items-center">
116.                 <span className="w-full border-t" />
117.               </div>
118.               <div className="relative flex justify-center text-xs uppercase">
119.                 <span className="bg-background px-2 text-muted-foreground">
120.                   Or continue with email
121.                 </span>
122.               </div>
123.             </div>
124. 
125.             <form onSubmit={handleSubmit} className="space-y-3">
126.               <div className="space-y-1.5">
127.                 <Label htmlFor="auth-email">Email</Label>
128.                 <Input
129.                   id="auth-email"
130.                   type="email"
131.                   value={email}
132.                   onChange={(e) => setEmail(e.target.value)}
133.                   placeholder="you@example.com"
134.                   required
135.                   autoComplete="email"
136.                 />
137.               </div>
138.               <div className="space-y-1.5">
139.                 <Label htmlFor="auth-password">Password</Label>
140.                 <Input
141.                   id="auth-password"
142.                   type="password"
143.                   value={password}
144.                   onChange={(e) => setPassword(e.target.value)}
145.                   placeholder="At least 6 characters"
146.                   required
147.                   minLength={6}
148.                   autoComplete={mode === "login" ? "current-password" : "new-password"}
149.                 />
150.               </div>
151. 
152.               {error && (
153.                 <p className="text-sm text-destructive">{error}</p>
154.               )}
155. 
156.               <Button type="submit" className="w-full" disabled={loading}>
157.                 {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
158.                 {mode === "login" ? "Sign in" : "Create account"}
159.               </Button>
160.             </form>
161. 
162.             <p className="text-center text-sm text-muted-foreground">
163.               {mode === "login" ? "No account? " : "Already have an account? "}
164.               <button
165.                 type="button"
166.                 className="text-primary underline-offset-4 hover:underline"
167.                 onClick={toggleMode}
168.               >
169.                 {mode === "login" ? "Sign up" : "Sign in"}
170.               </button>
171.             </p>
172.           </div>
173.         )}
174.       </DialogContent>
175.     </Dialog>
176.   );
177. }
178. 
179. function GitHubIcon({ className }: { className?: string }) {
180.   return (
181.     <svg className={className} viewBox="0 0 24 24" fill="currentColor">
182.       <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
183.     </svg>
184.   );
185. }
186. 
187. function GoogleIcon({ className }: { className?: string }) {
188.   return (
189.     <svg className={className} viewBox="0 0 24 24">
190.       <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
191.       <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
192.       <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
193.       <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
194.     </svg>
195.   );
196. }
197.
```

</details>


### ✅ `bash`

**List migration files**

$ cd /home/azureuser/ai-prompt-pro && find supabase/migrations -type f -name "*.sql" | sort

```
supabase/migrations/20260209000000_initial_schema.sql
supabase/migrations/20260209001000_hardening_persistence.sql
<exited with exit code 0>
```


### ✅ `view`

**view the file at /home/azureuser/ai-prompt-pro/supabase/migrations/20260209000000_initial_schema.sql.**

/home/azureuser/ai-prompt-pro/supabase/migrations/20260209000000_initial_schema.sql

<details>
<summary>136 lines</summary>

```
1. -- ============================================================
2. -- Initial schema: profiles, drafts, templates, prompt_versions
3. -- ============================================================
4. 
5. -- 1. profiles — auto-created on signup via trigger
6. create table public.profiles (
7.   id          uuid primary key references auth.users on delete cascade,
8.   display_name text,
9.   avatar_url   text,
10.   created_at   timestamptz not null default now(),
11.   updated_at   timestamptz not null default now()
12. );
13. 
14. alter table public.profiles enable row level security;
15. 
16. create policy "Users can read own profile"
17.   on public.profiles for select
18.   using (auth.uid() = id);
19. 
20. create policy "Users can update own profile"
21.   on public.profiles for update
22.   using (auth.uid() = id)
23.   with check (auth.uid() = id);
24. 
25. -- Trigger: auto-create profile on signup
26. create or replace function public.handle_new_user()
27. returns trigger
28. language plpgsql
29. security definer set search_path = ''
30. as $$
31. begin
32.   insert into public.profiles (id, display_name, avatar_url)
33.   values (
34.     new.id,
35.     coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
36.     coalesce(new.raw_user_meta_data ->> 'avatar_url', '')
37.   );
38.   return new;
39. end;
40. $$;
41. 
42. create trigger on_auth_user_created
43.   after insert on auth.users
44.   for each row execute function public.handle_new_user();
45. 
46. -- 2. drafts — one active draft per user (upsert-friendly)
47. create table public.drafts (
48.   id         uuid primary key default gen_random_uuid(),
49.   user_id    uuid not null references auth.users on delete cascade,
50.   config     jsonb not null default '{}',
51.   updated_at timestamptz not null default now(),
52.   constraint drafts_user_id_unique unique (user_id)
53. );
54. 
55. alter table public.drafts enable row level security;
56. 
57. create policy "Users can read own draft"
58.   on public.drafts for select
59.   using (auth.uid() = user_id);
60. 
61. create policy "Users can insert own draft"
62.   on public.drafts for insert
63.   with check (auth.uid() = user_id);
64. 
65. create policy "Users can update own draft"
66.   on public.drafts for update
67.   using (auth.uid() = user_id)
68.   with check (auth.uid() = user_id);
69. 
70. create policy "Users can delete own draft"
71.   on public.drafts for delete
72.   using (auth.uid() = user_id);
73. 
74. -- 3. templates — saved presets per user
75. create table public.templates (
76.   id          uuid primary key default gen_random_uuid(),
77.   user_id     uuid not null references auth.users on delete cascade,
78.   name        text not null,
79.   description text not null default '',
80.   tags        text[] not null default '{}',
81.   config      jsonb not null default '{}',
82.   fingerprint text,
83.   revision    int not null default 1,
84.   created_at  timestamptz not null default now(),
85.   updated_at  timestamptz not null default now(),
86.   constraint templates_user_name_unique unique (user_id, name)
87. );
88. 
89. alter table public.templates enable row level security;
90. 
91. create policy "Users can read own templates"
92.   on public.templates for select
93.   using (auth.uid() = user_id);
94. 
95. create policy "Users can insert own templates"
96.   on public.templates for insert
97.   with check (auth.uid() = user_id);
98. 
99. create policy "Users can update own templates"
100.   on public.templates for update
101.   using (auth.uid() = user_id)
102.   with check (auth.uid() = user_id);
103. 
104. create policy "Users can delete own templates"
105.   on public.templates for delete
106.   using (auth.uid() = user_id);
107. 
108. create index templates_user_id_idx on public.templates (user_id);
109. create index templates_updated_at_idx on public.templates (updated_at desc);
110. 
111. -- 4. prompt_versions — saved prompt snapshots
112. create table public.prompt_versions (
113.   id         uuid primary key default gen_random_uuid(),
114.   user_id    uuid not null references auth.users on delete cascade,
115.   name       text not null,
116.   prompt     text not null,
117.   created_at timestamptz not null default now()
118. );
119. 
120. alter table public.prompt_versions enable row level security;
121. 
122. create policy "Users can read own versions"
123.   on public.prompt_versions for select
124.   using (auth.uid() = user_id);
125. 
126. create policy "Users can insert own versions"
127.   on public.prompt_versions for insert
128.   with check (auth.uid() = user_id);
129. 
130. create policy "Users can delete own versions"
131.   on public.prompt_versions for delete
132.   using (auth.uid() = user_id);
133. 
134. create index prompt_versions_user_id_idx on public.prompt_versions (user_id);
135. create index prompt_versions_created_at_idx on public.prompt_versions (created_at desc);
136.
```

</details>


### ✅ `view`

**view the file at /home/azureuser/ai-prompt-pro/supabase/migrations/20260209001000_hardening_persistence.sql.**

/home/azureuser/ai-prompt-pro/supabase/migrations/20260209001000_hardening_persistence.sql

<details>
<summary>60 lines</summary>

```
1. -- ============================================================
2. -- Persistence hardening: case-insensitive template names,
3. -- updated_at consistency triggers, and query-friendly indexes.
4. -- ============================================================
5. 
6. -- Keep updated_at correct even when writes do not explicitly set it.
7. create or replace function public.set_updated_at()
8. returns trigger
9. language plpgsql
10. as $$
11. begin
12.   new.updated_at = now();
13.   return new;
14. end;
15. $$;
16. 
17. drop trigger if exists set_profiles_updated_at on public.profiles;
18. create trigger set_profiles_updated_at
19. before update on public.profiles
20. for each row execute function public.set_updated_at();
21. 
22. drop trigger if exists set_drafts_updated_at on public.drafts;
23. create trigger set_drafts_updated_at
24. before update on public.drafts
25. for each row execute function public.set_updated_at();
26. 
27. drop trigger if exists set_templates_updated_at on public.templates;
28. create trigger set_templates_updated_at
29. before update on public.templates
30. for each row execute function public.set_updated_at();
31. 
32. -- Ensure template names are unique per user regardless of casing.
33. with ranked_templates as (
34.   select
35.     id,
36.     row_number() over (
37.       partition by user_id, lower(name)
38.       order by updated_at desc, created_at desc, id desc
39.     ) as duplicate_rank
40.   from public.templates
41. )
42. delete from public.templates as templates
43. using ranked_templates
44. where templates.id = ranked_templates.id
45.   and ranked_templates.duplicate_rank > 1;
46. 
47. alter table public.templates
48.   drop constraint if exists templates_user_name_unique;
49. 
50. drop index if exists public.templates_user_name_unique_ci;
51. create unique index templates_user_name_unique_ci
52.   on public.templates (user_id, lower(name));
53. 
54. -- Match filter+sort query pattern used by the app.
55. create index if not exists templates_user_updated_at_idx
56.   on public.templates (user_id, updated_at desc);
57. 
58. create index if not exists prompt_versions_user_created_at_idx
59.   on public.prompt_versions (user_id, created_at desc);
60.
```

</details>


### ✅ `bash`

**Review template-store changes**

$ cd /home/azureuser/ai-prompt-pro && git --no-pager diff src/lib/template-store.ts

<details>
<summary>100 lines</summary>

```diff
diff --git a/src/lib/template-store.ts b/src/lib/template-store.ts
index 016ebe1..2643ada 100644
--- a/src/lib/template-store.ts
+++ b/src/lib/template-store.ts
@@ -185,7 +185,7 @@ function mergeContextConfig(input?: ContextConfig): ContextConfig {
   };
 }
 
-function normalizePromptConfig(config: PromptConfig): PromptConfig {
+export function normalizeTemplateConfig(config: PromptConfig): PromptConfig {
   const merged: PromptConfig = {
     ...defaultConfig,
     ...config,
@@ -203,7 +203,7 @@ function normalizePromptConfig(config: PromptConfig): PromptConfig {
   };
 }
 
-function fingerprintFromConfig(config: PromptConfig): string {
+export function computeTemplateFingerprint(config: PromptConfig): string {
   const canonical = cloneDeep(config);
   canonical.contextConfig.sources = canonical.contextConfig.sources.map((source) => ({
     ...source,
@@ -312,7 +312,7 @@ function validateRag(rag: RagParameters): string[] {
   return warnings;
 }
 
-function collectWarnings(config: PromptConfig): string[] {
+export function collectTemplateWarnings(config: PromptConfig): string[] {
   const warnings: string[] = [];
   config.contextConfig.sources.forEach((source) => {
     if (source.validation?.status === "invalid") {
@@ -429,7 +429,7 @@ function parseEnvelope(raw: string | null): TemplateEnvelope {
 
 function migrateLegacyV1(legacy: LegacyTemplateRecordV1): TemplateRecord {
   const now = Date.now();
-  const config: PromptConfig = normalizePromptConfig({
+  const config: PromptConfig = normalizeTemplateConfig({
     ...defaultConfig,
     role: legacy.role || "",
     task: legacy.task || "",
@@ -441,7 +441,7 @@ function migrateLegacyV1(legacy: LegacyTemplateRecordV1): TemplateRecord {
     constraints: Array.isArray(legacy.constraints) ? legacy.constraints : [],
     examples: legacy.examples || "",
   });
-  const fingerprint = fingerprintFromConfig(config);
+  const fingerprint = computeTemplateFingerprint(config);
   return {
     metadata: {
       id: legacy.id || generateId("tpl"),
@@ -468,7 +468,7 @@ function parseTemplateRecord(raw: unknown): TemplateRecord | null {
     const metadata = raw.metadata;
     const state = raw.state;
     if (typeof metadata.name !== "string" || typeof metadata.id !== "string") return null;
-    const normalizedConfig = normalizePromptConfig((state.promptConfig || defaultConfig) as PromptConfig);
+    const normalizedConfig = normalizeTemplateConfig((state.promptConfig || defaultConfig) as PromptConfig);
     const externalReferences = Array.isArray(state.externalReferences)
       ? (state.externalReferences as TemplateExternalReference[])
       : externalReferencesFromConfig(normalizedConfig);
@@ -485,7 +485,7 @@ function parseTemplateRecord(raw: unknown): TemplateRecord | null {
         fingerprint:
           typeof metadata.fingerprint === "string"
             ? metadata.fingerprint
-            : fingerprintFromConfig(normalizedConfig),
+            : computeTemplateFingerprint(normalizedConfig),
         createdAt: typeof metadata.createdAt === "number" ? metadata.createdAt : Date.now(),
         updatedAt: typeof metadata.updatedAt === "number" ? metadata.updatedAt : Date.now(),
       },
@@ -542,7 +542,7 @@ function clipText(value: string, limit: number): string {
   return `${value.slice(0, limit - 3).trimEnd()}...`;
 }
 
-function inferStarterPrompt(config: PromptConfig): string {
+export function inferTemplateStarterPrompt(config: PromptConfig): string {
   const candidates = [
     config.task,
     config.originalPrompt,
@@ -562,7 +562,7 @@ export function listTemplateSummaries(): TemplateSummary[] {
     name: record.metadata.name,
     description: record.metadata.description,
     tags: record.metadata.tags,
-    starterPrompt: inferStarterPrompt(record.state.promptConfig),
+    starterPrompt: inferTemplateStarterPrompt(record.state.promptConfig),
     updatedAt: record.metadata.updatedAt,
     createdAt: record.metadata.createdAt,
     revision: record.metadata.revision,
@@ -579,7 +579,7 @@ export function loadTemplateById(id: string): TemplateLoadResult | null {
   if (!record) return null;
   return {
     record: cloneDeep(record),
-    warnings: collectWarnings(record.state.promptConfig),
+    warnings: collectTemplateWarnings(record.state.promptConfig),
   };
 }
 
@@ -588,9 +588,9 @@ export function saveTemplateSnapshot(input: TemplateSaveInput): SaveTemplateResu
   if (!name) throw new Error("Preset name is required.");
 
   const now = Date.now();
-  const normalizedConfig = normalizePromptConfig(input.config);
-  const fingerprint = fingerprintFromConfig(normalizedConfig);
-  const warnings = collectWarnings(normalizedConfig);
+  const normalizedConfig = normalizeTemplateConfig(input.config);
+  const fingerprint = computeTemplateFingerprint(normalizedConfig);
+  const warnings = collectTemplateWarnings(normalizedConfig);
   const records = readAllRecords();
   const existingIndex = records.findIndex((record) => record.metadata.name.toLowerCase() === name.toLowerCase());
<exited with exit code 0>
```

</details>


### 💬 Copilot

Now let me check the Supabase types and run the tests to see if there are any issues:

### ✅ `bash`

**Review supabase types changes**

$ cd /home/azureuser/ai-prompt-pro && git --no-pager diff src/integrations/supabase/types.ts | head -200

<details>
<summary>153 lines</summary>

```diff
diff --git a/src/integrations/supabase/types.ts b/src/integrations/supabase/types.ts
index 54fedf1..b1f2eed 100644
--- a/src/integrations/supabase/types.ts
+++ b/src/integrations/supabase/types.ts
@@ -14,7 +14,146 @@ export type Database = {
   }
   public: {
     Tables: {
-      [_ in never]: never
+      drafts: {
+        Row: {
+          id: string
+          user_id: string
+          config: Json
+          updated_at: string
+        }
+        Insert: {
+          id?: string
+          user_id: string
+          config?: Json
+          updated_at?: string
+        }
+        Update: {
+          id?: string
+          user_id?: string
+          config?: Json
+          updated_at?: string
+        }
+        Relationships: [
+          {
+            foreignKeyName: "drafts_user_id_fkey"
+            columns: ["user_id"]
+            isOneToOne: true
+            referencedRelation: "users"
+            referencedColumns: ["id"]
+          },
+        ]
+      }
+      profiles: {
+        Row: {
+          id: string
+          display_name: string | null
+          avatar_url: string | null
+          created_at: string
+          updated_at: string
+        }
+        Insert: {
+          id: string
+          display_name?: string | null
+          avatar_url?: string | null
+          created_at?: string
+          updated_at?: string
+        }
+        Update: {
+          id?: string
+          display_name?: string | null
+          avatar_url?: string | null
+          created_at?: string
+          updated_at?: string
+        }
+        Relationships: [
+          {
+            foreignKeyName: "profiles_id_fkey"
+            columns: ["id"]
+            isOneToOne: true
+            referencedRelation: "users"
+            referencedColumns: ["id"]
+          },
+        ]
+      }
+      prompt_versions: {
+        Row: {
+          id: string
+          user_id: string
+          name: string
+          prompt: string
+          created_at: string
+        }
+        Insert: {
+          id?: string
+          user_id: string
+          name: string
+          prompt: string
+          created_at?: string
+        }
+        Update: {
+          id?: string
+          user_id?: string
+          name?: string
+          prompt?: string
+          created_at?: string
+        }
+        Relationships: [
+          {
+            foreignKeyName: "prompt_versions_user_id_fkey"
+            columns: ["user_id"]
+            isOneToOne: false
+            referencedRelation: "users"
+            referencedColumns: ["id"]
+          },
+        ]
+      }
+      templates: {
+        Row: {
+          id: string
+          user_id: string
+          name: string
+          description: string
+          tags: string[]
+          config: Json
+          fingerprint: string | null
+          revision: number
+          created_at: string
+          updated_at: string
+        }
+        Insert: {
+          id?: string
+          user_id: string
+          name: string
+          description?: string
+          tags?: string[]
+          config?: Json
+          fingerprint?: string | null
+          revision?: number
+          created_at?: string
+          updated_at?: string
+        }
+        Update: {
+          id?: string
+          user_id?: string
+          name?: string
+          description?: string
+          tags?: string[]
+          config?: Json
+          fingerprint?: string | null
+          revision?: number
+          created_at?: string
+          updated_at?: string
+        }
+        Relationships: [
+          {
+            foreignKeyName: "templates_user_id_fkey"
+            columns: ["user_id"]
+            isOneToOne: false
+            referencedRelation: "users"
+            referencedColumns: ["id"]
+          },
+        ]
+      }
     }
     Views: {
       [_ in never]: never
<exited with exit code 0>
```

</details>


### ✅ `view`

**view the file at /home/azureuser/ai-prompt-pro/src/test/persistence.test.ts.**

/home/azureuser/ai-prompt-pro/src/test/persistence.test.ts

<details>
<summary>171 lines</summary>

```
1. import { beforeEach, describe, expect, it, vi } from "vitest";
2. import { defaultConfig, type PromptConfig } from "@/lib/prompt-builder";
3. 
4. const { fromMock } = vi.hoisted(() => ({
5.   fromMock: vi.fn(),
6. }));
7. 
8. vi.mock("@/integrations/supabase/client", () => ({
9.   supabase: {
10.     from: fromMock,
11.   },
12. }));
13. 
14. function buildConfig(overrides?: Partial<PromptConfig>): PromptConfig {
15.   return {
16.     ...defaultConfig,
17.     ...overrides,
18.     contextConfig: {
19.       ...defaultConfig.contextConfig,
20.       ...overrides?.contextConfig,
21.       sources: overrides?.contextConfig?.sources || [],
22.       databaseConnections: overrides?.contextConfig?.databaseConnections || [],
23.       rag: {
24.         ...defaultConfig.contextConfig.rag,
25.         ...overrides?.contextConfig?.rag,
26.       },
27.       structured: {
28.         ...defaultConfig.contextConfig.structured,
29.         ...overrides?.contextConfig?.structured,
30.       },
31.       interviewAnswers: overrides?.contextConfig?.interviewAnswers || [],
32.     },
33.   };
34. }
35. 
36. describe("persistence", () => {
37.   beforeEach(() => {
38.     fromMock.mockReset();
39.   });
40. 
41.   it("normalizes template payloads before cloud insert and preserves warnings", async () => {
42.     const { saveTemplate } = await import("@/lib/persistence");
43.     let insertedPayload: Record<string, unknown> | null = null;
44. 
45.     fromMock.mockReturnValueOnce({
46.       select: () => ({
47.         eq: () => ({
48.           ilike: () => ({
49.             order: () => ({
50.               limit: async () => ({ data: [], error: null }),
51.             }),
52.           }),
53.         }),
54.       }),
55.     });
56. 
57.     fromMock.mockReturnValueOnce({
58.       insert: (payload: Record<string, unknown>) => {
59.         insertedPayload = payload;
60.         return {
61.           select: () => ({
62.             single: async () => ({
63.               data: {
64.                 id: "tpl_1",
65.                 name: payload.name,
66.                 description: payload.description,
67.                 tags: payload.tags,
68.                 config: payload.config,
69.                 fingerprint: payload.fingerprint,
70.                 revision: 1,
71.                 created_at: "2026-02-09T00:00:00.000Z",
72.                 updated_at: "2026-02-09T00:00:00.000Z",
73.               },
74.               error: null,
75.             }),
76.           }),
77.         };
78.       },
79.     });
80. 
81.     const result = await saveTemplate("user_1", {
82.       name: "Risky",
83.       config: buildConfig({
84.         task: "Investigate incident",
85.         contextConfig: {
86.           ...defaultConfig.contextConfig,
87.           sources: [
88.             {
89.               id: "url-1",
90.               type: "url",
91.               title: "Runbook",
92.               rawContent: "https://example.com/runbook",
93.               summary: "",
94.               addedAt: Date.now(),
95.             },
96.           ],
97.           databaseConnections: [
98.             {
99.               id: "db-1",
100.               label: "Primary",
101.               provider: "postgres",
102.               connectionRef: "",
103.               database: "app",
104.               schema: "public",
105.               tables: ["events"],
106.               readOnly: false,
107.             },
108.           ],
109.           rag: {
110.             ...defaultConfig.contextConfig.rag,
111.             enabled: true,
112.             vectorStoreRef: "",
113.             topK: 0,
114.           },
115.         },
116.       }),
117.     });
118. 
119.     const source = (insertedPayload?.config as PromptConfig).contextConfig.sources[0];
120.     expect(source.rawContent).toBe("");
121.     expect(typeof insertedPayload?.fingerprint).toBe("string");
122.     expect(result.outcome).toBe("created");
123.     expect(result.warnings.length).toBeGreaterThan(0);
124.   });
125. 
126.   it("returns false on delete when no row is removed", async () => {
127.     const { deleteTemplate } = await import("@/lib/persistence");
128. 
129.     fromMock.mockReturnValueOnce({
130.       delete: () => ({
131.         eq: () => ({
132.           eq: () => ({
133.             select: () => ({
134.               maybeSingle: async () => ({ data: null, error: null }),
135.             }),
136.           }),
137.         }),
138.       }),
139.     });
140. 
141.     await expect(deleteTemplate("user_1", "missing")).resolves.toBe(false);
142.   });
143. 
144.   it("throws typed unauthorized errors for load failures", async () => {
145.     const { loadTemplateById } = await import("@/lib/persistence");
146. 
147.     fromMock.mockReturnValueOnce({
148.       select: () => ({
149.         eq: () => ({
150.           eq: () => ({
151.             maybeSingle: async () => ({
152.               data: null,
153.               error: {
154.                 code: "42501",
155.                 message: 'new row violates row-level security policy for table "templates"',
156.                 details: "",
157.                 hint: "",
158.               },
159.             }),
160.           }),
161.         }),
162.       }),
163.     });
164. 
165.     await expect(loadTemplateById("user_1", "tpl_1")).rejects.toMatchObject({
166.       name: "PersistenceError",
167.       code: "unauthorized",
168.     });
169.   });
170. });
171.
```

</details>


### 💬 Copilot

Now let me run the tests and check for TypeScript compilation errors:

### ✅ `bash`

**Run tests**

$ cd /home/azureuser/ai-prompt-pro && npm test 2>&1 | head -100

<details>
<summary>13 lines</summary>

```
> vite_react_shadcn_ts@0.0.0 test
> vitest run


 RUN  v3.2.4 /home/azureuser/ai-prompt-pro

 ✓ src/test/example.test.ts (1 test) 2ms
 ✓ src/test/text-diff.test.ts (3 tests) 3ms
 ✓ src/test/section-health.test.ts (4 tests) 3ms
 ✓ src/test/template-store.test.ts (4 tests) 15ms
 ✓ src/test/persistence.test.ts (3 tests) 25ms

 Test Files  5 passed (5)
      Tests  15 passed (15)
   Start at  21:48:26
   Duration  738ms (transform 110ms, setup 193ms, collect 209ms, tests 47ms, environment 1.31s, prepare 1.02s)
<exited with exit code 0>
```

</details>


### 💬 Copilot

Good! Now let me check for TypeScript compilation errors:

### ✅ `bash`

**Check TypeScript compilation**

$ cd /home/azureuser/ai-prompt-pro && npx tsc --noEmit 2>&1

```
⠙
<exited with exit code 0>
```


### 💬 Copilot

Great! Now let me deeply analyze the code for race conditions and logic bugs. Let me trace through the critical auth change flow:

### ✅ `view`

**view the file at /home/azureuser/ai-prompt-pro/src/hooks/usePromptBuilder.ts.**

/home/azureuser/ai-prompt-pro/src/hooks/usePromptBuilder.ts (lines 54-160)

<details>
<summary>107 lines</summary>

```
54.   };
55. }
56. 
57. function loadLocalDraft(): PromptConfig {
58.   try {
59.     const saved = localStorage.getItem(STORAGE_KEY);
60.     return saved ? hydrateConfig(JSON.parse(saved)) : defaultConfig;
61.   } catch {
62.     return defaultConfig;
63.   }
64. }
65. 
66. export function usePromptBuilder() {
67.   const { user } = useAuth();
68.   const { toast } = useToast();
69.   const userId = user?.id ?? null;
70.   const [config, setConfig] = useState<PromptConfig>(loadLocalDraft);
71.   const [enhancedPrompt, setEnhancedPrompt] = useState("");
72.   const [isEnhancing, setIsEnhancing] = useState(false);
73.   const [versions, setVersions] = useState<persistence.PromptVersion[]>([]);
74.   const [templateSummaries, setTemplateSummaries] = useState<TemplateSummary[]>(() =>
75.     listLocalTemplateSummaries(),
76.   );
77.   const [isDraftDirty, setIsDraftDirty] = useState(false);
78.   const [isCloudHydrated, setIsCloudHydrated] = useState(false);
79. 
80.   const prevUserId = useRef<string | null>(null);
81.   const draftSaveError = useRef<string | null>(null);
82.   const authLoadToken = useRef(0);
83.   const autosaveToken = useRef(0);
84.   const editsSinceAuthChange = useRef(false);
85. 
86.   const showPersistenceError = useCallback(
87.     (title: string, error: unknown, fallback: string) => {
88.       toast({
89.         title,
90.         description: persistence.getPersistenceErrorMessage(error, fallback),
91.         variant: "destructive",
92.       });
93.     },
94.     [toast],
95.   );
96. 
97.   const markDraftDirty = useCallback(() => {
98.     editsSinceAuthChange.current = true;
99.     setIsDraftDirty(true);
100.   }, []);
101. 
102.   // Load draft/templates/versions when the auth identity changes.
103.   useEffect(() => {
104.     if (userId === prevUserId.current) return;
105.     prevUserId.current = userId;
106.     draftSaveError.current = null;
107.     editsSinceAuthChange.current = false;
108.     setIsDraftDirty(false);
109. 
110.     const token = ++authLoadToken.current;
111. 
112.     if (!userId) {
113.       setIsCloudHydrated(true);
114.       setConfig(loadLocalDraft());
115.       setTemplateSummaries(listLocalTemplateSummaries());
116.       setVersions([]);
117.       return;
118.     }
119. 
120.     setIsCloudHydrated(false);
121. 
122.     void Promise.allSettled([
123.       persistence.loadDraft(userId),
124.       persistence.loadTemplates(userId),
125.       persistence.loadVersions(userId),
126.     ]).then(([draftResult, templatesResult, versionsResult]) => {
127.       if (token !== authLoadToken.current) return;
128. 
129.       if (draftResult.status === "fulfilled") {
130.         if (draftResult.value && !editsSinceAuthChange.current) {
131.           setConfig(hydrateConfig(draftResult.value));
132.         }
133.       } else {
134.         showPersistenceError("Failed to load draft", draftResult.reason, "Failed to load draft.");
135.       }
136. 
137.       if (templatesResult.status === "fulfilled") {
138.         setTemplateSummaries(templatesResult.value);
139.       } else {
140.         setTemplateSummaries([]);
141.         showPersistenceError("Failed to load presets", templatesResult.reason, "Failed to load presets.");
142.       }
143. 
144.       if (versionsResult.status === "fulfilled") {
145.         setVersions(versionsResult.value);
146.       } else {
147.         setVersions([]);
148.         showPersistenceError(
149.           "Failed to load version history",
150.           versionsResult.reason,
151.           "Failed to load version history.",
152.         );
153.       }
154. 
155.       setIsCloudHydrated(true);
156.       if (!editsSinceAuthChange.current) {
157.         setIsDraftDirty(false);
158.       }
159.     });
160.   }, [userId, showPersistenceError]);
```

</details>


### ✅ `view`

**view the file at /home/azureuser/ai-prompt-pro/src/hooks/usePromptBuilder.ts.**

/home/azureuser/ai-prompt-pro/src/hooks/usePromptBuilder.ts (lines 162-220)

<details>
<summary>59 lines</summary>

```
162.   const refreshTemplateSummaries = useCallback(async () => {
163.     if (userId) {
164.       try {
165.         const summaries = await persistence.loadTemplates(userId);
166.         setTemplateSummaries(summaries);
167.       } catch (error) {
168.         showPersistenceError("Failed to refresh presets", error, "Failed to refresh presets.");
169.       }
170.     } else {
171.       setTemplateSummaries(listLocalTemplateSummaries());
172.     }
173.   }, [userId, showPersistenceError]);
174. 
175.   const saveDraftSafely = useCallback(
176.     async (nextConfig: PromptConfig, saveToken: number) => {
177.       try {
178.         await persistence.saveDraft(userId, nextConfig);
179.         draftSaveError.current = null;
180.         if (saveToken === autosaveToken.current) {
181.           setIsDraftDirty(false);
182.         }
183.       } catch (error) {
184.         const message = persistence.getPersistenceErrorMessage(error, "Failed to save draft.");
185.         if (draftSaveError.current !== message) {
186.           draftSaveError.current = message;
187.           toast({
188.             title: "Draft auto-save failed",
189.             description: message,
190.             variant: "destructive",
191.           });
192.         }
193.       }
194.     },
195.     [userId, toast],
196.   );
197. 
198.   // Auto-save draft (debounced)
199.   useEffect(() => {
200.     if (!isDraftDirty) return;
201.     if (userId && !isCloudHydrated) return;
202. 
203.     const saveToken = ++autosaveToken.current;
204.     const timeout = setTimeout(() => {
205.       void saveDraftSafely(config, saveToken);
206.     }, DRAFT_AUTOSAVE_DELAY_MS);
207. 
208.     return () => clearTimeout(timeout);
209.   }, [config, isDraftDirty, userId, isCloudHydrated, saveDraftSafely]);
210. 
211.   const updateConfig = useCallback(
212.     (updates: Partial<PromptConfig>) => {
213.       setConfig((prev) => ({ ...prev, ...updates }));
214.       markDraftDirty();
215.     },
216.     [markDraftDirty],
217.   );
218. 
219.   const resetConfig = useCallback(() => {
220.     setConfig(defaultConfig);
```

</details>


### 💬 Copilot

Now let me trace through some critical scenarios to look for bugs. Let me examine a few specific flows more carefully:

### ✅ `bash`

**Check RLS policies for auth**

$ cd /home/azureuser/ai-prompt-pro && grep -n "user_id" supabase/migrations/*.sql | grep -i policy

```

<exited with exit code 1>
```


### ✅ `bash`

**Check RLS policy authentication**

$ cd /home/azureuser/ai-prompt-pro && grep -n "auth.uid()" supabase/migrations/*.sql

<details>
<summary>17 lines</summary>

```
supabase/migrations/20260209000000_initial_schema.sql:18:  using (auth.uid() = id);
supabase/migrations/20260209000000_initial_schema.sql:22:  using (auth.uid() = id)
supabase/migrations/20260209000000_initial_schema.sql:23:  with check (auth.uid() = id);
supabase/migrations/20260209000000_initial_schema.sql:59:  using (auth.uid() = user_id);
supabase/migrations/20260209000000_initial_schema.sql:63:  with check (auth.uid() = user_id);
supabase/migrations/20260209000000_initial_schema.sql:67:  using (auth.uid() = user_id)
supabase/migrations/20260209000000_initial_schema.sql:68:  with check (auth.uid() = user_id);
supabase/migrations/20260209000000_initial_schema.sql:72:  using (auth.uid() = user_id);
supabase/migrations/20260209000000_initial_schema.sql:93:  using (auth.uid() = user_id);
supabase/migrations/20260209000000_initial_schema.sql:97:  with check (auth.uid() = user_id);
supabase/migrations/20260209000000_initial_schema.sql:101:  using (auth.uid() = user_id)
supabase/migrations/20260209000000_initial_schema.sql:102:  with check (auth.uid() = user_id);
supabase/migrations/20260209000000_initial_schema.sql:106:  using (auth.uid() = user_id);
supabase/migrations/20260209000000_initial_schema.sql:124:  using (auth.uid() = user_id);
supabase/migrations/20260209000000_initial_schema.sql:128:  with check (auth.uid() = user_id);
supabase/migrations/20260209000000_initial_schema.sql:132:  using (auth.uid() = user_id);
<exited with exit code 0>
```

</details>


### 💬 Copilot

Let me check what happens with the resetConfig when a user is logged in:

### ✅ `view`

**view the file at /home/azureuser/ai-prompt-pro/src/hooks/usePromptBuilder.ts.**

/home/azureuser/ai-prompt-pro/src/hooks/usePromptBuilder.ts (lines 219-235)

<details>
<summary>17 lines</summary>

```
219.   const resetConfig = useCallback(() => {
220.     setConfig(defaultConfig);
221.     setEnhancedPrompt("");
222.     if (!userId) {
223.       persistence.clearLocalDraft();
224.       setIsDraftDirty(false);
225.       editsSinceAuthChange.current = false;
226.       return;
227.     }
228.     markDraftDirty();
229.   }, [userId, markDraftDirty]);
230. 
231.   const clearOriginalPrompt = useCallback(() => {
232.     setConfig((prev) => ({
233.       ...prev,
234.       originalPrompt: "",
235.     }));
```

</details>


### 💬 Copilot

Now let me analyze the persistence layer more carefully for potential issues with the template lookup:

### ✅ `view`

**view the file at /home/azureuser/ai-prompt-pro/src/lib/persistence.ts.**

/home/azureuser/ai-prompt-pro/src/lib/persistence.ts (lines 220-280)

<details>
<summary>61 lines</summary>

```
220. 
221. export async function saveTemplate(
222.   userId: string | null,
223.   input: TemplateSaveInput,
224. ): Promise<SaveTemplateResult> {
225.   if (!userId) return saveLocalTemplate(input);
226. 
227.   const name = input.name.trim();
228.   if (!name) throw new PersistenceError("unknown", "Preset name is required.");
229. 
230.   const normalizedConfig = normalizeTemplateConfig(input.config);
231.   const fingerprint = computeTemplateFingerprint(normalizedConfig);
232.   const warnings = collectTemplateWarnings(normalizedConfig);
233.   const tags = normalizeTags(input.tags);
234. 
235.   try {
236.     const { data: existingRows, error: lookupError } = await supabase
237.       .from("templates")
238.       .select(TEMPLATE_SELECT_COLUMNS)
239.       .eq("user_id", userId)
240.       .ilike("name", name)
241.       .order("updated_at", { ascending: false })
242.       .limit(1);
243. 
244.     if (lookupError) throw mapPostgrestError(lookupError, "Failed to save preset.");
245.     const existing = existingRows?.[0] ?? null;
246. 
247.     if (existing?.fingerprint === fingerprint) {
248.       return {
249.         outcome: "unchanged",
250.         record: rowToRecord(existing, normalizedConfig),
251.         warnings,
252.       };
253.     }
254. 
255.     if (existing) {
256.       const { data: updated, error } = await supabase
257.         .from("templates")
258.         .update({
259.           description: input.description?.trim() || existing.description,
260.           tags: tags ?? existing.tags ?? [],
261.           config: normalizedConfig as unknown as Json,
262.           fingerprint,
263.           revision: existing.revision + 1,
264.         })
265.         .eq("id", existing.id)
266.         .eq("user_id", userId)
267.         .select(TEMPLATE_SELECT_COLUMNS)
268.         .single();
269. 
270.       if (error) throw mapPostgrestError(error, "Failed to update preset.");
271.       if (!updated) throw new PersistenceError("unknown", "Preset update returned no data.");
272.       return {
273.         outcome: "updated",
274.         record: rowToRecord(updated, normalizedConfig),
275.         warnings,
276.       };
277.     }
278. 
279.     const { data: created, error: insertError } = await supabase
280.       .from("templates")
```

</details>


### 💬 Copilot

Now let me check if there's a race condition in the saveVersion function when it's called for unauthenticated users:

### ✅ `view`

**view the file at /home/azureuser/ai-prompt-pro/src/hooks/usePromptBuilder.ts.**

/home/azureuser/ai-prompt-pro/src/hooks/usePromptBuilder.ts (lines 326-353)

<details>
<summary>28 lines</summary>

```
326. 
327.   const saveVersion = useCallback(
328.     (name?: string) => {
329.       const promptToSave = enhancedPrompt || builtPrompt;
330.       if (!promptToSave) return;
331.       const versionName = name || `Version ${versions.length + 1}`;
332. 
333.       if (userId) {
334.         void persistence
335.           .saveVersion(userId, versionName, promptToSave)
336.           .then((saved) => {
337.             if (saved) setVersions((prev) => [saved, ...prev]);
338.           })
339.           .catch((error) => {
340.             showPersistenceError("Failed to save version", error, "Failed to save version.");
341.           });
342.       } else {
343.         const version: persistence.PromptVersion = {
344.           id: Date.now().toString(),
345.           name: versionName,
346.           prompt: promptToSave,
347.           timestamp: Date.now(),
348.         };
349.         setVersions((prev) => [version, ...prev]);
350.       }
351.     },
352.     [enhancedPrompt, builtPrompt, versions.length, userId, showPersistenceError],
353.   );
```

</details>


### 💬 Copilot

Now let me check how the draft is saved and if there's any issue with duplicate saves or missing awaits:

### ✅ `bash`

**Check clearLocalDraft implementation**

$ cd /home/azureuser/ai-prompt-pro && grep -A 5 -B 5 "clearLocalDraft" src/lib/persistence.ts

<details>
<summary>11 lines</summary>

```
} catch (error) {
    throw toPersistenceError(error, "Failed to save cloud draft.");
  }
}

export function clearLocalDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
<exited with exit code 0>
```

</details>


### 💬 Copilot

Let me check the useAuth implementation for possible issues with anonymous session handling:

### ✅ `bash`

**Check anonymous session handling**

$ cd /home/azureuser/ai-prompt-pro && grep -n "is_anonymous" src/hooks/useAuth.tsx

```
33:      if (s?.user?.is_anonymous) {
46:      if (s?.user?.is_anonymous) {
<exited with exit code 0>
```


### 💬 Copilot

Let me now trace through potential data loss scenarios. Let me check what happens when the user signs out:

### ✅ `bash`

**Check signOut implementation**

$ cd /home/azureuser/ai-prompt-pro && grep -B 10 -A 10 "signOut" src/hooks/useAuth.tsx | tail -20

<details>
<summary>18 lines</summary>

```
return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signUp, signIn, signInWithOAuth, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
<exited with exit code 0>
```

</details>


### 💬 Copilot

Now let me trace through the auth change flow when signing out to see if there's a data loss scenario:

### ✅ `bash`

**Trace auth change effect**

$ cd /home/azureuser/ai-prompt-pro && cat -n src/hooks/usePromptBuilder.ts | grep -A 30 "Load draft/templates/versions"

<details>
<summary>32 lines</summary>

```
102	  // Load draft/templates/versions when the auth identity changes.
   103	  useEffect(() => {
   104	    if (userId === prevUserId.current) return;
   105	    prevUserId.current = userId;
   106	    draftSaveError.current = null;
   107	    editsSinceAuthChange.current = false;
   108	    setIsDraftDirty(false);
   109	
   110	    const token = ++authLoadToken.current;
   111	
   112	    if (!userId) {
   113	      setIsCloudHydrated(true);
   114	      setConfig(loadLocalDraft());
   115	      setTemplateSummaries(listLocalTemplateSummaries());
   116	      setVersions([]);
   117	      return;
   118	    }
   119	
   120	    setIsCloudHydrated(false);
   121	
   122	    void Promise.allSettled([
   123	      persistence.loadDraft(userId),
   124	      persistence.loadTemplates(userId),
   125	      persistence.loadVersions(userId),
   126	    ]).then(([draftResult, templatesResult, versionsResult]) => {
   127	      if (token !== authLoadToken.current) return;
   128	
   129	      if (draftResult.status === "fulfilled") {
   130	        if (draftResult.value && !editsSinceAuthChange.current) {
   131	          setConfig(hydrateConfig(draftResult.value));
   132	        }
<exited with exit code 0>
```

</details>


### 💬 Copilot

Now I need to check one critical issue - what happens to versions for local users. Let me check the saveVersion flow again more carefully:

### ✅ `bash`

**Check saveVersion for local users**

$ cd /home/azureuser/ai-prompt-pro && grep -B 5 -A 15 "const saveVersion = useCallback" src/hooks/usePromptBuilder.ts

<details>
<summary>19 lines</summary>

```
);

  const builtPrompt = buildPrompt(config);
  const score = scorePrompt(config);

  const saveVersion = useCallback(
    (name?: string) => {
      const promptToSave = enhancedPrompt || builtPrompt;
      if (!promptToSave) return;
      const versionName = name || `Version ${versions.length + 1}`;

      if (userId) {
        void persistence
          .saveVersion(userId, versionName, promptToSave)
          .then((saved) => {
            if (saved) setVersions((prev) => [saved, ...prev]);
          })
          .catch((error) => {
            showPersistenceError("Failed to save version", error, "Failed to save version.");
          });
      } else {
<exited with exit code 0>
```

</details>


### 💬 Copilot

Let me look at the entire return value to check if the versions state is persisted locally:

### ✅ `bash`

**Find return statement**

$ cd /home/azureuser/ai-prompt-pro && grep -n "return {" src/hooks/usePromptBuilder.ts | tail -1

```
419:  return {
<exited with exit code 0>
```


### ✅ `view`

**view the file at /home/azureuser/ai-prompt-pro/src/hooks/usePromptBuilder.ts.**

/home/azureuser/ai-prompt-pro/src/hooks/usePromptBuilder.ts (lines 419-460)

<details>
<summary>28 lines</summary>

```
419.   return {
420.     config,
421.     updateConfig,
422.     resetConfig,
423.     clearOriginalPrompt,
424.     builtPrompt,
425.     score,
426.     enhancedPrompt,
427.     setEnhancedPrompt,
428.     isEnhancing,
429.     setIsEnhancing,
430.     versions,
431.     saveVersion,
432.     loadTemplate,
433.     saveAsTemplate,
434.     loadSavedTemplate,
435.     deleteSavedTemplate,
436.     templateSummaries,
437.     // Context-specific
438.     updateContextSources,
439.     updateDatabaseConnections,
440.     updateRagParameters,
441.     updateContextStructured,
442.     updateContextInterview,
443.     updateProjectNotes,
444.     toggleDelimiters,
445.   };
446. }
```

</details>


### 💬 Copilot

Now let me examine one more critical flow - what happens during the template update if the user_id check fails or there's a race with simultaneous updates:

### ✅ `view`

**view the file at /home/azureuser/ai-prompt-pro/src/lib/persistence.ts.**

/home/azureuser/ai-prompt-pro/src/lib/persistence.ts (lines 255-277)

<details>
<summary>23 lines</summary>

```
255.     if (existing) {
256.       const { data: updated, error } = await supabase
257.         .from("templates")
258.         .update({
259.           description: input.description?.trim() || existing.description,
260.           tags: tags ?? existing.tags ?? [],
261.           config: normalizedConfig as unknown as Json,
262.           fingerprint,
263.           revision: existing.revision + 1,
264.         })
265.         .eq("id", existing.id)
266.         .eq("user_id", userId)
267.         .select(TEMPLATE_SELECT_COLUMNS)
268.         .single();
269. 
270.       if (error) throw mapPostgrestError(error, "Failed to update preset.");
271.       if (!updated) throw new PersistenceError("unknown", "Preset update returned no data.");
272.       return {
273.         outcome: "updated",
274.         record: rowToRecord(updated, normalizedConfig),
275.         warnings,
276.       };
277.     }
```

</details>


### 💬 Copilot

Now let me check one critical scenario - what happens if a user makes edits while logged out, then logs in. Will those edits be saved to the cloud or lost?

### ✅ `bash`

**Check edit tracking during auth change**

$ cd /home/azureuser/ai-prompt-pro && grep -B 3 -A 10 "editsSinceAuthChange" src/hooks/usePromptBuilder.ts | head -40

<details>
<summary>35 lines</summary>

```
const draftSaveError = useRef<string | null>(null);
  const authLoadToken = useRef(0);
  const autosaveToken = useRef(0);
  const editsSinceAuthChange = useRef(false);

  const showPersistenceError = useCallback(
    (title: string, error: unknown, fallback: string) => {
      toast({
        title,
        description: persistence.getPersistenceErrorMessage(error, fallback),
        variant: "destructive",
      });
    },
    [toast],
  );

  const markDraftDirty = useCallback(() => {
    editsSinceAuthChange.current = true;
    setIsDraftDirty(true);
  }, []);

  // Load draft/templates/versions when the auth identity changes.
  useEffect(() => {
    if (userId === prevUserId.current) return;
    prevUserId.current = userId;
    draftSaveError.current = null;
    editsSinceAuthChange.current = false;
    setIsDraftDirty(false);

    const token = ++authLoadToken.current;

    if (!userId) {
      setIsCloudHydrated(true);
      setConfig(loadLocalDraft());
      setTemplateSummaries(listLocalTemplateSummaries());
      setVersions([]);
      return;
--
      if (token !== authLoadToken.current) return;
<exited with exit code 0>
```

</details>


### 💬 Copilot

Now I've found a critical issue! Let me verify it by checking the exact flow:

### ✅ `bash`

**View complete auth change effect**

$ cd /home/azureuser/ai-prompt-pro && awk '/Load draft.*when the auth identity changes/,/^\s*\}\);/ {print NR": "$0}' src/hooks/usePromptBuilder.ts | head -65

<details>
<summary>59 lines</summary>

```
102:   // Load draft/templates/versions when the auth identity changes.
103:   useEffect(() => {
104:     if (userId === prevUserId.current) return;
105:     prevUserId.current = userId;
106:     draftSaveError.current = null;
107:     editsSinceAuthChange.current = false;
108:     setIsDraftDirty(false);
109: 
110:     const token = ++authLoadToken.current;
111: 
112:     if (!userId) {
113:       setIsCloudHydrated(true);
114:       setConfig(loadLocalDraft());
115:       setTemplateSummaries(listLocalTemplateSummaries());
116:       setVersions([]);
117:       return;
118:     }
119: 
120:     setIsCloudHydrated(false);
121: 
122:     void Promise.allSettled([
123:       persistence.loadDraft(userId),
124:       persistence.loadTemplates(userId),
125:       persistence.loadVersions(userId),
126:     ]).then(([draftResult, templatesResult, versionsResult]) => {
127:       if (token !== authLoadToken.current) return;
128: 
129:       if (draftResult.status === "fulfilled") {
130:         if (draftResult.value && !editsSinceAuthChange.current) {
131:           setConfig(hydrateConfig(draftResult.value));
132:         }
133:       } else {
134:         showPersistenceError("Failed to load draft", draftResult.reason, "Failed to load draft.");
135:       }
136: 
137:       if (templatesResult.status === "fulfilled") {
138:         setTemplateSummaries(templatesResult.value);
139:       } else {
140:         setTemplateSummaries([]);
141:         showPersistenceError("Failed to load presets", templatesResult.reason, "Failed to load presets.");
142:       }
143: 
144:       if (versionsResult.status === "fulfilled") {
145:         setVersions(versionsResult.value);
146:       } else {
147:         setVersions([]);
148:         showPersistenceError(
149:           "Failed to load version history",
150:           versionsResult.reason,
151:           "Failed to load version history.",
152:         );
153:       }
154: 
155:       setIsCloudHydrated(true);
156:       if (!editsSinceAuthChange.current) {
157:         setIsDraftDirty(false);
158:       }
159:     });
<exited with exit code 0>
```

</details>


### 💬 Copilot

Perfect! Now I've identified the critical bug. Let me also verify the autosave behavior during this transition:

### ✅ `bash`

**Check autosave effect**

$ cd /home/azureuser/ai-prompt-pro && awk '/Auto-save draft/,/^\s*\}, \[/ {print NR": "$0}' src/hooks/usePromptBuilder.ts

<details>
<summary>13 lines</summary>

```
198:   // Auto-save draft (debounced)
199:   useEffect(() => {
200:     if (!isDraftDirty) return;
201:     if (userId && !isCloudHydrated) return;
202: 
203:     const saveToken = ++autosaveToken.current;
204:     const timeout = setTimeout(() => {
205:       void saveDraftSafely(config, saveToken);
206:     }, DRAFT_AUTOSAVE_DELAY_MS);
207: 
208:     return () => clearTimeout(timeout);
209:   }, [config, isDraftDirty, userId, isCloudHydrated, saveDraftSafely]);
<exited with exit code 0>
```

</details>


### 💬 Copilot

Perfect! Now let me analyze one more potential issue. Let me check if there's a race condition when userId changes but cloud data hasn't loaded yet, and a user makes edits:

### ✅ `bash`

**Check cloud hydration guard**

$ cd /home/azureuser/ai-prompt-pro && grep -n "if (userId && !isCloudHydrated)" src/hooks/usePromptBuilder.ts

```

<exited with exit code 0>
```


### ✅ `bash`

**Find all isCloudHydrated usage**

$ cd /home/azureuser/ai-prompt-pro && grep -n "isCloudHydrated" src/hooks/usePromptBuilder.ts

```
78:  const [isCloudHydrated, setIsCloudHydrated] = useState(false);
201:    if (userId && !isCloudHydrated) return;
209:  }, [config, isDraftDirty, userId, isCloudHydrated, saveDraftSafely]);
<exited with exit code 0>
```


### 💬 Copilot

Excellent! Now let me check one last issue - what happens when unauthenticated users save versions. Are those versions lost on sign in?

### ✅ `bash`

**Check local version handling**

$ cd /home/azureuser/ai-prompt-pro && grep -B 2 -A 8 "} else {" src/hooks/usePromptBuilder.ts | grep -A 10 "const version:"

<details>
<summary>9 lines</summary>

```
const version: persistence.PromptVersion = {
          id: Date.now().toString(),
          name: versionName,
          prompt: promptToSave,
          timestamp: Date.now(),
        };
        setVersions((prev) => [version, ...prev]);
      }
<exited with exit code 0>
```

</details>


### 💬 Copilot

Now I understand the full picture. Let me verify one more critical scenario - the .single() vs .maybeSingle() usage in updates:

### ✅ `bash`

**Check single usage**

$ cd /home/azureuser/ai-prompt-pro && grep -n "\.single()" src/lib/persistence.ts

```
268:        .single();
290:      .single();
374:      .single();
<exited with exit code 0>
```


### ✅ `view`

**view the file at /home/azureuser/ai-prompt-pro/src/lib/persistence.ts.**

/home/azureuser/ai-prompt-pro/src/lib/persistence.ts (lines 255-272)

<details>
<summary>18 lines</summary>

```
255.     if (existing) {
256.       const { data: updated, error } = await supabase
257.         .from("templates")
258.         .update({
259.           description: input.description?.trim() || existing.description,
260.           tags: tags ?? existing.tags ?? [],
261.           config: normalizedConfig as unknown as Json,
262.           fingerprint,
263.           revision: existing.revision + 1,
264.         })
265.         .eq("id", existing.id)
266.         .eq("user_id", userId)
267.         .select(TEMPLATE_SELECT_COLUMNS)
268.         .single();
269. 
270.       if (error) throw mapPostgrestError(error, "Failed to update preset.");
271.       if (!updated) throw new PersistenceError("unknown", "Preset update returned no data.");
272.       return {
```

</details>


### 💬 Copilot

Excellent! I've found a critical bug. Now let me verify the duplicate handling for templates with case-insensitive lookup. Let me check the migration:

### ✅ `view`

**view the file at /home/azureuser/ai-prompt-pro/supabase/migrations/20260209001000_hardening_persistence.sql.**

/home/azureuser/ai-prompt-pro/supabase/migrations/20260209001000_hardening_persistence.sql (lines 32-53)

<details>
<summary>22 lines</summary>

```
32. -- Ensure template names are unique per user regardless of casing.
33. with ranked_templates as (
34.   select
35.     id,
36.     row_number() over (
37.       partition by user_id, lower(name)
38.       order by updated_at desc, created_at desc, id desc
39.     ) as duplicate_rank
40.   from public.templates
41. )
42. delete from public.templates as templates
43. using ranked_templates
44. where templates.id = ranked_templates.id
45.   and ranked_templates.duplicate_rank > 1;
46. 
47. alter table public.templates
48.   drop constraint if exists templates_user_name_unique;
49. 
50. drop index if exists public.templates_user_name_unique_ci;
51. create unique index templates_user_name_unique_ci
52.   on public.templates (user_id, lower(name));
53.
```

</details>


### 💬 Copilot

Perfect! Now I've identified a critical race condition bug. Let me write my findings:

## Issue: Data Loss on Sign-In (User Edits Before Cloud Hydration)
**File:** src/hooks/usePromptBuilder.ts:103-159
**Severity:** Critical
**Problem:** When a user signs in, the auth change effect immediately sets `editsSinceAuthChange.current = false` (line 107) and then asynchronously loads the cloud draft. If the user makes ANY edits to the config while the cloud data is loading, those edits trigger `markDraftDirty()` which sets `editsSinceAuthChange.current = true`. However, when the cloud draft load completes (line 130-131), it checks `!editsSinceAuthChange.current` to decide whether to overwrite local state. This means:

1. User signs in → `editsSinceAuthChange` reset to false
2. User makes an edit during the 200-1000ms cloud load → `editsSinceAuthChange` set to true  
3. Cloud draft loads and checks the flag → sees it's true → does NOT overwrite with cloud data
4. The user's local draft from BEFORE login is retained, but the cloud draft is silently ignored

This creates an inconsistent state where the user expects to see their cloud data but instead sees stale local data mixed with their new edit.

**Evidence:** The code at lines 107-108 resets the flag unconditionally, then lines 130-131 check it to prevent overwriting user edits. But there's a timing window where the user's draft from their logged-out session remains, and the cloud draft is silently dropped.

**Suggested fix:** After cloud hydration completes successfully, if `editsSinceAuthChange.current` is true, show a conflict resolution UI asking the user whether to keep local changes or load the cloud draft. Alternatively, merge the changes or always prefer cloud data on sign-in and require explicit user action to discard cloud state.

---

## Issue: Update Race Condition in Template Save
**File:** src/lib/persistence.ts:235-277
**Severity:** High
**Problem:** The `saveTemplate` function performs a check-then-update pattern without optimistic locking. Between lines 236-245 (lookup query) and lines 256-268 (update query), another concurrent save of the same template could occur. This creates a classic TOCTOU (Time-of-Check-Time-of-Use) race condition:

1. User A queries for template "Analysis" → finds revision 5
2. User B queries for template "Analysis" → finds revision 5  
3. User A updates to revision 6
4. User B updates to revision 7 (but intended to update revision 6)

The update query at line 265-266 uses `.eq("id", existing.id).eq("user_id", userId)` but does NOT check that `revision = existing.revision`. This means the last write wins, and revision numbers become unreliable. If two browser tabs or devices save simultaneously, one user's changes will be silently overwritten.

**Evidence:** The `revision` field is incremented at line 263 based on the value read earlier, but the UPDATE query doesn't include a WHERE clause checking the current revision matches expectations. PostgreSQL won't detect the conflict.

**Suggested fix:** Add `.eq("revision", existing.revision)` to the update query filter (line 266), then check if `!updated` after line 268 and throw a conflict error, prompting the user to retry or merge changes.

---

## Issue: Unauthenticated User Version History Lost on Sign-In
**File:** src/hooks/usePromptBuilder.ts:116, 342-349
**Severity:** Medium
**Problem:** Unauthenticated users can save prompt versions (lines 342-349), which are stored in component state only (not localStorage). When the user signs in, the auth change effect (line 116) unconditionally clears the versions array with `setVersions([])` for the logged-out→logged-in transition, then loads cloud versions. This means any versions saved while logged out are permanently lost with no warning to the user.

**Evidence:** Line 116 in the auth change effect sets versions to empty array when transitioning from null→userId. Lines 342-349 show local versions are kept only in React state, not persisted. There's no code to preserve or migrate local versions on sign-in.

**Suggested fix:** Before clearing local versions on sign-in, either (1) prompt the user to optionally upload local versions to the cloud, (2) show a warning that local history will be lost, or (3) automatically upload local versions as a one-time migration.

No significant issues found in the reviewed changes.


---

<sub>⏱️ 3m 51s</sub>

### 💬 Copilot

Here's the review of uncommitted changes. **TypeScript compiles cleanly and all 15 tests pass**, but there are several issues worth addressing:

---

### 🔴 Critical: Data loss race on sign-in
**`src/hooks/usePromptBuilder.ts:103-131`** — When a user signs in, `editsSinceAuthChange` is reset, then the cloud draft loads asynchronously. If the user edits during that window, the cloud draft is silently discarded. Conversely, if they don't edit, their local (logged-out) draft is overwritten with no merge or confirmation. Either path can lose user work.

### 🟠 High: TOCTOU race in template save
**`src/lib/persistence.ts:235-268`** — `saveTemplate` does a read-then-update without optimistic locking. The UPDATE doesn't include `.eq("revision", existing.revision)`, so concurrent saves from multiple tabs/devices silently overwrite each other and produce unreliable revision numbers.

### 🟡 Medium: Local version history lost on sign-in
**`src/hooks/usePromptBuilder.ts:116`** — Unauthenticated users can create prompt versions (stored in React state only). On sign-in, `setVersions([])` is called before loading cloud versions, permanently discarding any locally-created history with no warning.

### 🟡 Medium: `saveVersion` silently drops for anonymous users
**`src/lib/persistence.ts` `saveVersion()`** returns `null` when `userId` is `null`. The caller in `usePromptBuilder.ts:335` falls through to a local-state-only code path, but the local versions are never persisted to `localStorage` — they only survive in memory and vanish on page reload.

### 🟡 Medium: Template name uniqueness check uses `ilike` without bounds
**`src/lib/persistence.ts:241`** — The lookup `.ilike("name", name)` does a case-insensitive match, but PostgreSQL `ilike` treats `%` and `_` as wildcards. If a user names a template `%` or `test_v2`, the lookup could match unintended rows. Use `.eq("name", name)` with a collation-based CI index (which the migration already provides via `lower(name)`), or escape the special characters.

### 🟢 Low: `handleSaveAsTemplate` in Index.tsx doesn't `await`
**`src/pages/Index.tsx`** — `handleSaveAsTemplate` is now `async` and correctly `await`s `saveAsTemplate`, but the function's return value (the try/catch block's implicit `undefined` on error) means the caller gets no feedback on failure — though this is mitigated by the toast error.

### ✅ What looks good
- RLS policies are comprehensive (SELECT/INSERT/UPDATE/DELETE per table, all scoped to `auth.uid()`)
- `updated_at` triggers ensure timestamp consistency
- The persistence layer correctly falls back to localStorage for unauthenticated users
- Auth state ignores anonymous Supabase sessions
- Error mapping (`PersistenceError`) is thorough and well-typed
- Tests cover the key persistence paths

---

<sub>Generated by [GitHub Copilot CLI](https://github.com/features/copilot/cli)</sub>
