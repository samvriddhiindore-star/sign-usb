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
import SystemUsersPage from "@/pages/system-users";
import WebAccessControlPage from "@/pages/web-access-control";
import ReportsPage from "@/pages/reports";
import SettingsPage from "@/pages/settings";
import NotificationsPage from "@/pages/notifications";
import DuplicateMacIdsPage from "@/pages/duplicate-macids";
import HelpIndex from "@/pages/help/index";
import GettingStartedHelp from "@/pages/help/getting-started";
import LoginHelp from "@/pages/help/login";
import DashboardHelp from "@/pages/help/dashboard";
import MachinesHelp from "@/pages/help/machines";
import SystemUsersHelp from "@/pages/help/system-users";
import UsersHelp from "@/pages/help/users";
import ReportsHelp from "@/pages/help/reports";
import WebsiteControlHelp from "@/pages/help/website-control";
import LogsHelp from "@/pages/help/logs";
import SettingsHelp from "@/pages/help/settings";
import TroubleshootingHelp from "@/pages/help/troubleshooting";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/systems" component={MachinesPage} />
      <Route path="/machines" component={MachinesPage} /> {/* legacy path */}
      <Route path="/machines/:id" component={MachineDetailPage} />
      <Route path="/system-users" component={SystemUsersPage} />
      <Route path="/users">
        <Redirect to="/settings" />
      </Route>
      <Route path="/web-access-control" component={WebAccessControlPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/logs" component={LogsPage} />
      <Route path="/notifications" component={NotificationsPage} />
      {/* Duplicate MAC IDs page removed - duplicates are now automatically merged */}
      {/* <Route path="/duplicate-macids" component={DuplicateMacIdsPage} /> */}
      <Route path="/settings" component={SettingsPage} />
      
      {/* Help Pages */}
      <Route path="/help" component={HelpIndex} />
      <Route path="/help/getting-started" component={GettingStartedHelp} />
      <Route path="/help/login" component={LoginHelp} />
      <Route path="/help/dashboard" component={DashboardHelp} />
      <Route path="/help/machines" component={MachinesHelp} />
      <Route path="/help/system-users" component={SystemUsersHelp} />
      <Route path="/help/users" component={UsersHelp} />
      <Route path="/help/reports" component={ReportsHelp} />
      <Route path="/help/website-control" component={WebsiteControlHelp} />
      <Route path="/help/logs" component={LogsHelp} />
      <Route path="/help/settings" component={SettingsHelp} />
      <Route path="/help/troubleshooting" component={TroubleshootingHelp} />
      
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
