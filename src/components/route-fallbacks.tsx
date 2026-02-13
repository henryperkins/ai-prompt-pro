import type { ReactNode } from "react";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function RouteFallbackFrame({ children }: { children: ReactNode }) {
  return (
    <PageShell>
      <div className="space-y-4 sm:space-y-5">{children}</div>
    </PageShell>
  );
}

function HeroFallback() {
  return (
    <div className="space-y-2 text-center">
      <Skeleton className="mx-auto h-8 w-56 sm:h-9 sm:w-72" />
      <Skeleton className="mx-auto h-4 w-full max-w-[520px]" />
    </div>
  );
}

export function BuilderRouteFallback() {
  return (
    <RouteFallbackFrame>
      <HeroFallback />
      <Card className="space-y-3 border-border/80 bg-card/85 p-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Skeleton className="h-56 w-full rounded-lg" />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
        <Skeleton className="h-11 w-full" />
      </Card>
    </RouteFallbackFrame>
  );
}

export function CommunityRouteFallback() {
  return (
    <RouteFallbackFrame>
      <HeroFallback />
      <Card className="space-y-3 border-border/80 bg-card/85 p-4">
        <Skeleton className="h-11 w-full" />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:rounded-lg sm:bg-muted sm:p-1">
          <Skeleton className="h-11 w-full sm:h-10" />
          <Skeleton className="h-11 w-full sm:h-10" />
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Skeleton className="h-56 w-full rounded-lg" />
        <Skeleton className="h-56 w-full rounded-lg" />
      </div>
    </RouteFallbackFrame>
  );
}

export function LibraryRouteFallback() {
  return (
    <RouteFallbackFrame>
      <HeroFallback />
      <Card className="space-y-3 border-border/80 bg-card/85 p-4">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </Card>
      <Card className="space-y-2 border-border/80 bg-card/85 p-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </Card>
    </RouteFallbackFrame>
  );
}

export function GenericRouteFallback() {
  return (
    <RouteFallbackFrame>
      <HeroFallback />
      <Card className="space-y-3 border-border/80 bg-card/85 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </Card>
    </RouteFallbackFrame>
  );
}
