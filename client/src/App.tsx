import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import ProjectView from "@/pages/ProjectView";
import NewTestsView from "@/pages/NewTestsView";
import PendingReviewView from "@/pages/PendingReviewView";
import ReadyToDeployView from "@/pages/ReadyToDeployView";
import CompletedView from "@/pages/CompletedView";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/tests/new" component={NewTestsView} />
          <Route path="/tests/pending-review" component={PendingReviewView} />
          <Route path="/tests/ready-to-deploy" component={ReadyToDeployView} />
          <Route path="/tests/completed" component={CompletedView} />
          <Route path="/projects/:id">
            {(params) => <ProjectView key={`project-${params.id}-${Date.now()}`} />}
          </Route>
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
