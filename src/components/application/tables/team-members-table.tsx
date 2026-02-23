import { useState } from "react";
import { ChevronLeft, ChevronRight, Filter, MoreHorizontal, Users } from "lucide-react";
import { Badge } from "@/components/base/badges/badges";
import { BadgeGroup } from "@/components/base/badges/badge-groups";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { Avatar, AvatarFallback } from "@/components/base/primitives/avatar";
import { Button } from "@/components/base/buttons/button";
import { Card } from "@/components/base/primitives/card";
import { Checkbox } from "@/components/base/primitives/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/base/primitives/table";
import { cn } from "@/lib/utils";

type TableSize = "md" | "sm";
type TableRows = "divider" | "alternating";

interface TeamMember {
  id: string;
  name: string;
  username: string;
  role: string;
  email: string;
  teams: string[];
  status: "Active" | "Pending";
}

const TEAM_MEMBERS: TeamMember[] = [
  {
    id: "1",
    name: "Olivia Rhye",
    username: "@olivia",
    role: "Product Designer",
    email: "olivia@example.com",
    teams: ["Design", "Product", "Marketing", "Research"],
    status: "Active",
  },
  {
    id: "2",
    name: "Phoenix Baker",
    username: "@phoenix",
    role: "Product Manager",
    email: "phoenix@example.com",
    teams: ["Design", "Product", "Marketing", "Growth"],
    status: "Active",
  },
  {
    id: "3",
    name: "Lana Steiner",
    username: "@lana",
    role: "Frontend Developer",
    email: "lana@example.com",
    teams: ["Design", "Product", "Frontend"],
    status: "Active",
  },
  {
    id: "4",
    name: "Demi Wilkinson",
    username: "@demi",
    role: "Backend Developer",
    email: "demi@example.com",
    teams: ["Platform", "API", "Security"],
    status: "Pending",
  },
  {
    id: "5",
    name: "Candice Wu",
    username: "@candice",
    role: "Fullstack Developer",
    email: "candice@example.com",
    teams: ["Product", "Frontend", "API"],
    status: "Active",
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function TeamMembersTableBlock() {
  const [size, setSize] = useState<TableSize>("md");
  const [rows, setRows] = useState<TableRows>("divider");
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  const pageSize = 3;
  const totalPages = Math.max(1, Math.ceil(TEAM_MEMBERS.length / pageSize));
  const pageStartIndex = (currentPage - 1) * pageSize;
  const visibleMembers = TEAM_MEMBERS.slice(pageStartIndex, pageStartIndex + pageSize);

  const selectedOnPageCount = visibleMembers.filter((member) => selectedMemberIds.has(member.id)).length;
  const allVisibleSelected = visibleMembers.length > 0 && selectedOnPageCount === visibleMembers.length;
  const hasPartialSelection = selectedOnPageCount > 0 && !allVisibleSelected;

  const compact = size === "sm";
  const cellClassName = compact ? "py-2 text-xs" : "py-3 text-sm";
  const headClassName = compact ? "h-10 py-2 text-2xs" : "h-11 py-2 text-xs";

  return (
    <Card className="overflow-hidden border-border/80 bg-card/90">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Team members</h3>
          <BadgeGroup addonText={`${TEAM_MEMBERS.length} users`} iconTrailing={Users}>
            Last updated just now
          </BadgeGroup>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ButtonGroup
            size="sm"
            value={size}
            onValueChange={(value) => value && setSize(value as TableSize)}
            aria-label="Table size"
          >
            <ButtonGroupItem value="md" size="sm">
              Medium
            </ButtonGroupItem>
            <ButtonGroupItem value="sm" size="sm">
              Small
            </ButtonGroupItem>
          </ButtonGroup>

          <ButtonGroup
            size="sm"
            value={rows}
            onValueChange={(value) => value && setRows(value as TableRows)}
            aria-label="Table row style"
          >
            <ButtonGroupItem value="divider" size="sm">
              Divider
            </ButtonGroupItem>
            <ButtonGroupItem value="alternating" size="sm">
              Alternating
            </ButtonGroupItem>
          </ButtonGroup>

          <ButtonUtility
            icon={Filter}
            size="xs"
            color="tertiary"
            tooltip="Filters coming soon"
            aria-label="Table filters"
            isDisabled
          />
        </div>
      </div>

      <Table className={cn(compact && "text-xs")}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn("w-10 pl-4", headClassName)}>
              <Checkbox
                aria-label="Select all team members"
                checked={allVisibleSelected ? true : hasPartialSelection ? "indeterminate" : false}
                onCheckedChange={(checked) => {
                  const nextChecked = checked === true;
                  setSelectedMemberIds((prev) => {
                    const next = new Set(prev);
                    visibleMembers.forEach((member) => {
                      if (nextChecked) {
                        next.add(member.id);
                      } else {
                        next.delete(member.id);
                      }
                    });
                    return next;
                  });
                }}
              />
            </TableHead>
            <TableHead className={headClassName}>Name</TableHead>
            <TableHead className={headClassName}>Status</TableHead>
            <TableHead className={headClassName}>Role</TableHead>
            <TableHead className={headClassName}>Email address</TableHead>
            <TableHead className={headClassName}>Teams</TableHead>
            <TableHead className={cn("w-12", headClassName)}>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {visibleMembers.map((member) => {
            const visibleTeams = member.teams.slice(0, 2);
            const hiddenCount = Math.max(0, member.teams.length - visibleTeams.length);
            return (
              <TableRow key={member.id} className={cn(rows === "alternating" && "odd:bg-muted/30")}>
                <TableCell className={cn("pl-4", cellClassName)}>
                  <Checkbox
                    aria-label={`Select ${member.name}`}
                    checked={selectedMemberIds.has(member.id)}
                    onCheckedChange={(checked) => {
                      setSelectedMemberIds((prev) => {
                        const next = new Set(prev);
                        if (checked === true) {
                          next.add(member.id);
                        } else {
                          next.delete(member.id);
                        }
                        return next;
                      });
                    }}
                  />
                </TableCell>

                <TableCell className={cellClassName}>
                  <div className="flex items-center gap-2.5">
                    <Avatar className={cn("border border-border/70", compact ? "h-8 w-8" : "h-9 w-9")}>
                      <AvatarFallback className="bg-muted text-xs font-semibold text-muted-foreground">
                        {initials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.username}</p>
                    </div>
                  </div>
                </TableCell>

                <TableCell className={cellClassName}>
                  <Badge tone={member.status === "Active" ? "success" : "warning"} size="sm">
                    {member.status}
                  </Badge>
                </TableCell>

                <TableCell className={cn("text-muted-foreground", cellClassName)}>{member.role}</TableCell>
                <TableCell className={cn("text-muted-foreground", cellClassName)}>{member.email}</TableCell>

                <TableCell className={cellClassName}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {visibleTeams.map((team) => (
                      <Badge key={`${member.id}-${team}`} size="sm">
                        {team}
                      </Badge>
                    ))}
                    {hiddenCount > 0 ? (
                      <Badge tone="default" size="sm">
                        +{hiddenCount}
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>

                <TableCell className={cellClassName}>
                  <ButtonUtility
                    icon={MoreHorizontal}
                    size="xs"
                    color="tertiary"
                    tooltip="More actions"
                    aria-label={`Actions for ${member.name}`}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t border-border/70 px-4 py-3 sm:px-5">
        <p className="text-xs text-muted-foreground">
          Page {currentPage} of {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <Button
            color="secondary"
            size="sm"
            className="h-8 px-2.5 text-xs"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </Button>
          <Button
            color="secondary"
            size="sm"
            className="h-8 px-2.5 text-xs"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
