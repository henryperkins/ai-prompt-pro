import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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
  const [reason, setReason] = useState("harassment");
  const [details, setDetails] = useState("");

  useEffect(() => {
    if (!open) {
      setReason("harassment");
      setDetails("");
    }
  }, [open]);

  const trimmedDetails = details.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report content</DialogTitle>
          <DialogDescription>
            Tell us what is wrong with this {targetLabel}. Reports help keep the community safe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="community-report-reason">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="community-report-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => void onSubmit({ reason, details: trimmedDetails })}
            disabled={!reason || submitting}
          >
            {submitting ? "Submitting..." : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
