import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHero, PageShell } from "@/components/PageShell";
import { decodeSelectionIds } from "@/lib/library-pages";

const LIBRARY_SELECTION_STORAGE_KEY = "library-selection-ids";

const LibraryBulkEdit = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const ids = decodeSelectionIds(searchParams);
    if (typeof window !== "undefined" && ids.length > 0) {
      window.sessionStorage.setItem(LIBRARY_SELECTION_STORAGE_KEY, JSON.stringify(ids));
    }
    navigate("/library", { replace: true });
  }, [navigate, searchParams]);

  return (
    <PageShell>
      <PageHero
        title="Bulk edit moved"
        subtitle="Redirecting to Library where bulk actions are now inline."
        className="pf-gilded-frame pf-hero-surface"
      />
    </PageShell>
  );
};

export default LibraryBulkEdit;
