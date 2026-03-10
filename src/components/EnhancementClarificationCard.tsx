import { Button } from "@/components/base/buttons/button";
import { Card } from "@/components/base/card";

interface EnhancementClarificationCardProps {
  questions: string[];
  onAddToPrompt: () => void;
  onAddToSessionContext: () => void;
  onCopyQuestions: () => void;
}

export function EnhancementClarificationCard({
  questions,
  onAddToPrompt,
  onAddToSessionContext,
  onCopyQuestions,
}: EnhancementClarificationCardProps) {
  if (questions.length === 0) return null;

  return (
    <Card className="space-y-3 border-warning-primary/25 bg-warning-primary/5 p-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          Clarification needed
        </p>
        <p className="text-sm text-muted-foreground">
          This enhanced prompt is provisional until these questions are answered.
        </p>
      </div>

      <ol className="space-y-1.5 pl-5 text-sm text-foreground/85">
        {questions.map((question, index) => (
          <li key={`${question}-${index}`} className="list-decimal">
            {question}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onAddToPrompt}>
          Add questions to prompt
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onAddToSessionContext}
        >
          Add to session context
        </Button>
        <Button type="button" variant="tertiary" size="sm" onClick={onCopyQuestions}>
          Copy questions
        </Button>
      </div>
    </Card>
  );
}
