import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { PageShell } from "@/components/PageShell";
import { StateCard } from "@/components/base/primitives/state-card";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <PageShell mainClassName="pf-community-page flex items-center justify-center py-10">
      <div className="w-full max-w-lg">
        <StateCard
          variant="error"
          title="Page not found"
          description={`This page (${location.pathname}) does not exist or has moved.`}
          primaryAction={{ label: "Back to Builder", to: "/" }}
          secondaryAction={{ label: "Open Community", to: "/community" }}
          className="pf-card p-6"
        />
      </div>
    </PageShell>
  );
};

export default NotFound;
