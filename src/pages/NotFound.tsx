import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <PageShell mainClassName="py-10 flex items-center justify-center">
        <Card className="w-full max-w-lg border-border/80 bg-card p-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Error 404</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Page not found</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            The page <span className="font-mono text-foreground">{location.pathname}</span> does not exist or was moved.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2">
            <Button asChild>
              <Link to="/">Back to Builder</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/community">Open Community</Link>
            </Button>
          </div>
        </Card>
    </PageShell>
  );
};

export default NotFound;
