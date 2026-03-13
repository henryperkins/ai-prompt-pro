import { Button } from "@/components/base/buttons/button";
import { Card } from "@/components/base/card";

interface EnhancementClarificationCardProps {
  questions: string[];
  onAddToPrompt: () => void;
  onAddToSessionContext?: () => void;
  onCopyQuestions: () => void;
  compact?: boolean;
}

export function EnhancementClarificationCard({
  questions,
  onAddToPrompt,
  onAddToSessionContext,
  onCopyQuestions,
  compact = false,
}: EnhancementClarificationCardProps) {
  if (questions.length === 0) return null;

  return (
    <Card
      className="space-y-3 border-warning-primary/25 bg-warning-primary/5 p-3"
      data-testid="output-panel-clarification-card"
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          Clarification needed
        </p>
        <p className="text-sm text-muted-foreground">
          {compact
            ? "This result still has unanswered questions before it should be treated as final."
            : "This enhanced prompt is provisional until these questions are answered."}
        </p>
      </div>

      {compact ? (
        <p className="text-sm text-foreground/85">
          {questions.length === 1
            ? `1 clarification question is waiting in Enhancement details.`
            : `${questions.length} clarification questions are waiting in Enhancement details.`}
        </p>
      ) : (
        <ol className="space-y-1.5 pl-5 text-sm text-foreground/85">
          {questions.map((question, index) => (
            <li key={`${question}-${index}`} className="list-decimal">
              {question}
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onAddToPrompt}>
          Add questions to prompt
        </Button>
        {onAddToSessionContext && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onAddToSessionContext}
          >
            Add to session context
          </Button>
        )}
        <Button type="button" variant="tertiary" size="sm" onClick={onCopyQuestions}>
          Copy questions
        </Button>
      </div>
    </Card>
  );
}
