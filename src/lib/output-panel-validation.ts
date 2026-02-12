export interface SavePromptValidationErrors {
  name?: string;
}

export interface SaveAndSharePromptValidationErrors extends SavePromptValidationErrors {
  useCase?: string;
  confirmedSafe?: string;
}

export interface SaveDialogValidationInput {
  name: string;
  shareEnabled: boolean;
  useCase?: string;
  confirmedSafe?: boolean;
}

export function validateSavePromptInput(name: string): SavePromptValidationErrors {
  if (!name.trim()) {
    return { name: "Prompt title is required." };
  }
  return {};
}

export function validateSaveAndSharePromptInput(input: {
  name: string;
  useCase: string;
  confirmedSafe: boolean;
}): SaveAndSharePromptValidationErrors {
  const errors: SaveAndSharePromptValidationErrors = {};
  if (!input.name.trim()) {
    errors.name = "Prompt title is required.";
  }
  if (!input.useCase.trim()) {
    errors.useCase = "Use case is required.";
  }
  if (!input.confirmedSafe) {
    errors.confirmedSafe = "Confirm that the prompt contains no private or secret data.";
  }
  return errors;
}

export function validateSaveDialogInput(
  input: SaveDialogValidationInput,
): SaveAndSharePromptValidationErrors {
  const baseErrors = validateSavePromptInput(input.name);
  if (!input.shareEnabled) {
    return baseErrors;
  }

  const shareErrors = validateSaveAndSharePromptInput({
    name: input.name,
    useCase: input.useCase ?? "",
    confirmedSafe: input.confirmedSafe === true,
  });
  return { ...baseErrors, ...shareErrors };
}
