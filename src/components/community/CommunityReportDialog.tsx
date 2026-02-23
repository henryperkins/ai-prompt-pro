import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/base/dialog";
import { Button } from "@/components/base/buttons/button";
import { Label } from "@/components/base/label";
import {
  Select,
} from "@/components/base/select/select";
import { Textarea } from "@/components/base/textarea";

const REPORT_REASON_OPTIONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate", label: "Hate or abuse" },
  { value: "sexual", label: "Sexual content" },
  { value: "violence", label: "Violence or threats" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Other" },
] as const;

interface CommunityReportDialogProps {
  open: boolean;
  targetLabel: string;
  submitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: { reason: string; details: string }) => Promise<void> | void;
}

export function CommunityReportDialog({
  open,
  targetLabel,
  submitting = false,
  onOpenChange,
  onSubmit,
}: CommunityReportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <CommunityReportDialogContent
          targetLabel={targetLabel}
          submitting={submitting}
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
        />
      )}
    </Dialog>
  );
}

interface CommunityReportDialogContentProps {
  targetLabel: string;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: { reason: string; details: string }) => Promise<void> | void;
}

function CommunityReportDialogContent({
  targetLabel,
  submitting,
  onOpenChange,
  onSubmit,
}: CommunityReportDialogContentProps) {
  const [reason, setReason] = useState("harassment");
  const [details, setDetails] = useState("");
  const trimmedDetails = details.trim();

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Report content</DialogTitle>
        <DialogDescription>
          Tell us what is wrong with this {targetLabel}. Reports help keep the community safe.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Reason</Label>
          <Select
            selectedKey={reason}
            onSelectionChange={(value) => {
              if (value !== null) {
                setReason(String(value));
              }
            }}
            placeholder="Select a reason"
            aria-label="Report reason"
          >
            {REPORT_REASON_OPTIONS.map((option) => (
              <Select.Item key={option.value} id={option.value}>
                {option.label}
              </Select.Item>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="community-report-details">Details</Label>
          <Textarea
            id="community-report-details"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Add optional context to help moderation review this report."
            className="min-h-[96px]"
            maxLength={2000}
          />
        </div>
      </div>

      <DialogFooter>
        <Button color="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={() => void onSubmit({ reason, details: trimmedDetails })} disabled={!reason || submitting}>
          {submitting ? "Submitting..." : "Submit report"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
