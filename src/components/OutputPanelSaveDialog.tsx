import { useEffect, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Label } from "@/components/base/label";
import { Textarea } from "@/components/base/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/base/dialog";
import { Select } from "@/components/base/select/select";
import { Checkbox } from "@/components/base/checkbox";
import { Switch } from "@/components/base/switch";
import { PROMPT_CATEGORY_OPTIONS } from "@/lib/prompt-categories";
import {
  validateSaveDialogInput,
} from "@/lib/output-panel-validation";
import { trackBuilderEvent } from "@/lib/telemetry";
import { cx } from "@/lib/utils/cx";

interface SavePromptInput {
  name: string;
  description?: string;
  tags?: string[];
  category?: string;
  remixNote?: string;
}

interface SaveAndSharePromptInput extends SavePromptInput {
  useCase: string;
  targetModel?: string;
}

export type { SavePromptInput, SaveAndSharePromptInput };

interface OutputPanelSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialShareEnabled: boolean;
  canSharePrompt: boolean;
  phase2Enabled: boolean;
  remixContext?: { title: string; authorName: string };
  onSavePrompt: (input: SavePromptInput) => void;
  onSaveAndSharePrompt: (input: SaveAndSharePromptInput) => void;
}

function parseTags(value: string): string[] | undefined {
  const tags = Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 8);

  return tags.length > 0 ? tags : undefined;
}

export function OutputPanelSaveDialog({
  open,
  onOpenChange,
  initialShareEnabled,
  canSharePrompt,
  phase2Enabled,
  remixContext,
  onSavePrompt,
  onSaveAndSharePrompt,
}: OutputPanelSaveDialogProps) {
  const [shareEnabled, setShareEnabled] = useState(initialShareEnabled);

  useEffect(() => {
    if (open) {
      setShareEnabled(initialShareEnabled);
      if (remixContext && !saveName.trim()) {
        setSaveName(`Remix of ${remixContext.title}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [saveTags, setSaveTags] = useState("");
  const [saveCategory, setSaveCategory] = useState("general");
  const [saveUseCase, setSaveUseCase] = useState("");
  const [saveTargetModel, setSaveTargetModel] = useState("");
  const [saveConfirmedSafe, setSaveConfirmedSafe] = useState(false);
  const [saveRemixNote, setSaveRemixNote] = useState("");
  const [saveNameTouched, setSaveNameTouched] = useState(false);
  const [saveUseCaseTouched, setSaveUseCaseTouched] = useState(false);
  const [saveConfirmedSafeTouched, setSaveConfirmedSafeTouched] = useState(false);
  const [saveSubmitAttempted, setSaveSubmitAttempted] = useState(false);

  const shareEnabledForUi = shareEnabled && canSharePrompt;

  const saveValidationErrors = validateSaveDialogInput({
    name: saveName,
    shareEnabled: shareEnabledForUi,
    useCase: saveUseCase,
    confirmedSafe: saveConfirmedSafe,
  });
  const saveNameError = saveValidationErrors.name ?? null;
  const showSaveNameError = Boolean(saveNameError && (saveNameTouched || saveSubmitAttempted));
  const saveUseCaseError = saveValidationErrors.useCase ?? null;
  const showSaveUseCaseError = Boolean(saveUseCaseError && (saveUseCaseTouched || saveSubmitAttempted));
  const saveConfirmedSafeError = saveValidationErrors.confirmedSafe ?? null;
  const showSaveConfirmedSafeError = Boolean(
    saveConfirmedSafeError && (saveConfirmedSafeTouched || saveSubmitAttempted),
  );

  const resetState = () => {
    setSaveName(remixContext ? `Remix of ${remixContext.title}` : "");
    setSaveDescription("");
    setSaveTags("");
    setSaveCategory("general");
    setSaveUseCase("");
    setSaveTargetModel("");
    setSaveConfirmedSafe(false);
    setSaveRemixNote("");
    setShareEnabled(false);
    setSaveNameTouched(false);
    setSaveUseCaseTouched(false);
    setSaveConfirmedSafeTouched(false);
    setSaveSubmitAttempted(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setSaveNameTouched(false);
      setSaveUseCaseTouched(false);
      setSaveConfirmedSafeTouched(false);
      setSaveSubmitAttempted(false);
    }
  };

  const handleShareToggleChange = (enabled: boolean) => {
    if (enabled && !canSharePrompt) return;
    setShareEnabled(enabled);
    trackBuilderEvent("builder_share_toggled", { enabled });
    if (!enabled) {
      setSaveUseCaseTouched(false);
      setSaveConfirmedSafeTouched(false);
    }
  };

  const handleSubmit = () => {
    setSaveSubmitAttempted(true);

    const canShareNow = shareEnabled && canSharePrompt;
    if (shareEnabled && !canSharePrompt) {
      setShareEnabled(false);
    }

    const effectiveErrors = canShareNow
      ? { nameErr: saveNameError, useCaseErr: saveUseCaseError, safeErr: saveConfirmedSafeError }
      : { nameErr: saveNameError, useCaseErr: null, safeErr: null };
    if (effectiveErrors.nameErr || effectiveErrors.useCaseErr || effectiveErrors.safeErr) {
      setSaveNameTouched(true);
      if (canShareNow) {
        setSaveUseCaseTouched(true);
        setSaveConfirmedSafeTouched(true);
      }
      return;
    }

    if (canShareNow) {
      onSaveAndSharePrompt({
        name: saveName.trim(),
        description: saveDescription.trim() || undefined,
        tags: parseTags(saveTags),
        category: saveCategory,
        useCase: saveUseCase.trim(),
        targetModel: saveTargetModel.trim() || undefined,
        remixNote: remixContext ? saveRemixNote.trim() || undefined : undefined,
      });
    } else {
      onSavePrompt({
        name: saveName.trim(),
        description: saveDescription.trim() || undefined,
        tags: parseTags(saveTags),
        category: saveCategory,
        remixNote: remixContext ? saveRemixNote.trim() || undefined : undefined,
      });
    }

    onOpenChange(false);
    resetState();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{shareEnabledForUi ? "Save & Share Prompt" : "Save Prompt"}</DialogTitle>
          <DialogDescription>
            {shareEnabledForUi
              ? "Publish this prompt recipe to the community feed."
              : "Save a private prompt snapshot to your library."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {remixContext && (
            <div className="rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary">
              Remixing {remixContext.authorName}&apos;s &quot;{remixContext.title}&quot;
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="save-dialog-name" className="text-sm font-medium">
              Prompt title
            </Label>
            <Input
              id="save-dialog-name"
              value={saveName}
              onChange={setSaveName}
              onBlur={() => setSaveNameTouched(true)}
              placeholder="Prompt title"
              wrapperClassName="bg-background"
              inputClassName="text-base"
              aria-invalid={showSaveNameError}
              aria-describedby="save-dialog-name-help"
            />
            <p
              id="save-dialog-name-help"
              className={cx("text-sm", showSaveNameError ? "text-destructive" : "text-muted-foreground")}
            >
              {showSaveNameError ? saveNameError : "Required."}
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">
              Category
            </Label>
            <Select
              selectedKey={saveCategory}
              onSelectionChange={(value) => {
                if (value !== null) {
                  setSaveCategory(String(value));
                }
              }}
              placeholder="Category"
              className="bg-background"
              aria-label="Category"
            >
              {PROMPT_CATEGORY_OPTIONS.map((category) => (
                <Select.Item key={category.value} id={category.value}>
                  {category.label}
                </Select.Item>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="save-dialog-description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="save-dialog-description"
              value={saveDescription}
              onChange={(event) => setSaveDescription(event.target.value)}
              placeholder="Description (optional)"
              className="min-h-[80px] bg-background"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="save-dialog-tags" className="text-sm font-medium">
              Tags
            </Label>
            <Input
              id="save-dialog-tags"
              value={saveTags}
              onChange={setSaveTags}
              placeholder="Tags (comma-separated, optional)"
              wrapperClassName="bg-background"
              inputClassName="text-base"
            />
          </div>
          {remixContext && (
            <div className="space-y-1">
              <Label htmlFor="save-dialog-remix-note" className="text-sm font-medium">
                Remix note
              </Label>
              <Textarea
                id="save-dialog-remix-note"
                value={saveRemixNote}
                onChange={(event) => setSaveRemixNote(event.target.value)}
                placeholder="Remix note (optional)"
                className="min-h-[80px] bg-background"
              />
            </div>
          )}

          {phase2Enabled && (
            <div className="rounded-md border border-border/80 bg-muted/30 px-3 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="save-dialog-share-toggle" className="text-sm font-medium text-foreground">
                    Share to community
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Enable to publish after saving.
                  </p>
                </div>
                <Switch
                  id="save-dialog-share-toggle"
                  checked={shareEnabledForUi}
                  onCheckedChange={handleShareToggleChange}
                  disabled={!canSharePrompt}
                />
              </div>
              {!canSharePrompt && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Sign in to enable sharing.
                </p>
              )}
            </div>
          )}

          {shareEnabledForUi && (
            <>
              <div className="space-y-1">
                <Label htmlFor="save-dialog-use-case" className="text-sm font-medium">
                  Use case
                </Label>
                <Textarea
                  id="save-dialog-use-case"
                  value={saveUseCase}
                  onChange={(event) => setSaveUseCase(event.target.value)}
                  onBlur={() => setSaveUseCaseTouched(true)}
                  placeholder="Describe how this prompt should be used"
                  className="min-h-[90px] bg-background"
                  aria-invalid={showSaveUseCaseError}
                  aria-describedby="save-dialog-use-case-help"
                />
                <p
                  id="save-dialog-use-case-help"
                  className={cx("text-sm", showSaveUseCaseError ? "text-destructive" : "text-muted-foreground")}
                >
                  {showSaveUseCaseError ? saveUseCaseError : "Required when sharing."}
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="save-dialog-target-model" className="text-sm font-medium">
                  Target model
                </Label>
                <Input
                  id="save-dialog-target-model"
                  value={saveTargetModel}
                  onChange={setSaveTargetModel}
                  placeholder="Target model (optional)"
                  wrapperClassName="bg-background"
                  inputClassName="text-base"
                />
              </div>
              <Checkbox
                isSelected={saveConfirmedSafe}
                onChange={(val) => {
                  setSaveConfirmedSafe(val);
                  setSaveConfirmedSafeTouched(true);
                }}
                isInvalid={showSaveConfirmedSafeError}
                aria-describedby="save-dialog-confirm-safe-help"
                label="I confirm this prompt contains no secrets or private data."
              />
              <p
                id="save-dialog-confirm-safe-help"
                className={cx(
                  "text-sm",
                  showSaveConfirmedSafeError ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {showSaveConfirmedSafeError ? saveConfirmedSafeError : "Required when sharing."}
              </p>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            {shareEnabledForUi ? "Save & Share" : "Save Prompt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
