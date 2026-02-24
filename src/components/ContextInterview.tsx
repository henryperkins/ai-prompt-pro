import { useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Badge, badgeVariants } from "@/components/base/badges/badges";
import { interviewQuestions } from "@/lib/context-types";
import type { InterviewAnswer } from "@/lib/context-types";
import { cn } from "@/lib/utils";
import { CaretRight as ChevronRight, ChatText as MessageSquareText, Check } from "@phosphor-icons/react";

interface ContextInterviewProps {
  answers: InterviewAnswer[];
  onUpdate: (answers: InterviewAnswer[]) => void;
}

export function ContextInterview({ answers, onUpdate }: ContextInterviewProps) {
  const [expanded, setExpanded] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const getAnswer = (qId: string) => answers.find((a) => a.questionId === qId)?.answer || "";

  const setAnswer = (qId: string, question: string, answer: string) => {
    const existing = answers.filter((a) => a.questionId !== qId);
    onUpdate([...existing, { questionId: qId, question, answer }]);
  };

  const answeredCount = answers.filter((a) => a.answer.trim()).length;
  const currentQ = interviewQuestions[currentStep];

  if (!expanded) {
    return (
      <div className="space-y-2">
        <Button
          color="secondary"
          size="sm"
          className="interactive-chip w-full justify-between gap-2 text-sm"
          onClick={() => setExpanded(true)}
        >
          <span className="flex items-center gap-2">
            <MessageSquareText className="w-3.5 h-3.5" />
            Ask me for missing context
          </span>
          {answeredCount > 0 && (
            <Badge type="modern" className="text-xs">
              {answeredCount}/{interviewQuestions.length}
            </Badge>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquareText className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            Context interview ({currentStep + 1}/{interviewQuestions.length})
          </span>
        </div>
        <Button
          color="tertiary"
          size="sm"
          className="interactive-chip h-11 text-sm sm:h-9"
          onClick={() => setExpanded(false)}
        >
          Minimize
        </Button>
      </div>

      <p className="text-sm font-medium text-foreground">{currentQ.question}</p>

      {currentQ.options ? (
        <div className="flex flex-wrap gap-2">
          {currentQ.options.map((opt) => {
            const selected = getAnswer(currentQ.id) === opt;
            return (
              <button
                type="button"
                key={opt}
                className={cn(
                  badgeVariants({ variant: selected ? "default" : "outline" }),
                  "interactive-chip cursor-pointer select-none text-xs"
                )}
                onClick={() => setAnswer(currentQ.id, currentQ.question, selected ? "" : opt)}
                aria-pressed={selected}
              >
                {selected && <Check className="w-3 h-3 mr-1" />}
                {opt}
              </button>
            );
          })}
        </div>
      ) : (
        <Input
          placeholder="Type your answer..."
          value={getAnswer(currentQ.id)}
          onChange={(e) => setAnswer(currentQ.id, currentQ.question, e.target.value)}
          className="bg-background"
        />
      )}

      <div className="flex justify-between pt-1">
        <Button
          color="tertiary"
          size="sm"
          className="interactive-chip text-sm"
          disabled={currentStep === 0}
          onClick={() => setCurrentStep((s) => s - 1)}
        >
          Previous
        </Button>
        {currentStep < interviewQuestions.length - 1 ? (
          <Button
            color="secondary"
            size="sm"
            className="interactive-chip gap-1 text-sm"
            onClick={() => setCurrentStep((s) => s + 1)}
          >
            Next
            <ChevronRight className="w-3 h-3" />
          </Button>
        ) : (
          <Button
            size="sm"
            className="interactive-chip gap-1 text-sm"
            onClick={() => setExpanded(false)}
          >
            <Check className="w-3 h-3" />
            Done
          </Button>
        )}
      </div>
    </div>
  );
}
