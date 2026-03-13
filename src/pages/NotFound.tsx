import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { PageHero, PageShell } from "@/components/PageShell";
import { StateCard } from "@/components/base/state-card";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <PageShell mainClassName="pf-community-page flex min-h-[70vh] items-center justify-center py-10">
      <div className="w-full max-w-2xl space-y-4">
        <PageHero
          pattern="utility"
          title="Page not found"
          subtitle="Return to Builder to keep drafting, or open Community if you were looking for shared remixes."
        />
        <StateCard
          variant="error"
          title="Check the link and keep moving"
          titleAs="p"
          description={`The route "${location.pathname}" does not exist or has moved. Check the address and use one of the routes below.`}
          primaryAction={{ label: "Back to Builder", to: "/" }}
          secondaryAction={{ label: "Open Community", to: "/community" }}
          className="pf-card p-6"
        />
      </div>
    </PageShell>
  );
};

export default NotFound;
