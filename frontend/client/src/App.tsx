import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import MachinesPage from "@/pages/machines";
import MachineDetailPage from "@/pages/machine-detail";
import DashboardPage from "@/pages/dashboard";
import LogsPage from "@/pages/logs";
import UsersPage from "@/pages/users";
import ProfilesPage from "@/pages/profiles";
import WebAccessControlPage from "@/pages/web-access-control";
import ReportsPage from "@/pages/reports";
import SettingsPage from "@/pages/settings";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/systems" component={MachinesPage} />
      <Route path="/machines" component={MachinesPage} /> {/* legacy path */}
      <Route path="/machines/:id" component={MachineDetailPage} />
      <Route path="/profiles" component={ProfilesPage} />
      <Route path="/users" component={UsersPage} /> {/* legacy path */}
      <Route path="/web-access-control" component={WebAccessControlPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/logs" component={LogsPage} />
      <Route path="/settings" component={SettingsPage} />
      
      {/* Default Redirects */}
      <Route path="/">
        <Redirect to="/login" />
      </Route>
      
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
