import { Suspense, lazy, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import {
  BuilderRouteFallback,
  CommunityRouteFallback,
  GenericRouteFallback,
  LibraryRouteFallback,
} from "@/components/route-fallbacks";

const Index = lazy(() => import("./pages/Index"));
const Community = lazy(() => import("./pages/Community"));
const CommunityPost = lazy(() => import("./pages/CommunityPost"));
const Library = lazy(() => import("./pages/Library"));
const LibraryBulkEdit = lazy(() => import("./pages/LibraryBulkEdit"));
const Presets = lazy(() => import("./pages/Presets"));
const History = lazy(() => import("./pages/History"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function withRouteFallback(element: ReactNode, fallback: ReactNode) {
  return <Suspense fallback={fallback}>{element}</Suspense>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <BrowserRouter>
          <ThemeProvider>
            <Toaster />
            <Sonner />
            <Routes>
              <Route path="/" element={withRouteFallback(<Index />, <BuilderRouteFallback />)} />
              <Route path="/community" element={withRouteFallback(<Community />, <CommunityRouteFallback />)} />
              <Route
                path="/community/:postId"
                element={withRouteFallback(<CommunityPost />, <CommunityRouteFallback />)}
              />
              <Route path="/library" element={withRouteFallback(<Library />, <LibraryRouteFallback />)} />
              <Route
                path="/library/bulk-edit"
                element={withRouteFallback(<LibraryBulkEdit />, <LibraryRouteFallback />)}
              />
              <Route path="/presets" element={withRouteFallback(<Presets />, <BuilderRouteFallback />)} />
              <Route path="/history" element={withRouteFallback(<History />, <GenericRouteFallback />)} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={withRouteFallback(<NotFound />, <GenericRouteFallback />)} />
            </Routes>
          </ThemeProvider>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
