import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Monitor, Wifi, WifiOff, Unlock, Lock, HardDrive, Activity, Calendar } from "lucide-react";
import { Link } from "wouter";

export default function DashboardHelp() {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
            <p className="text-muted-foreground mt-1">
              Understanding your system's health and security status
            </p>
          </div>
        </div>

        <div className="p-3 bg-muted rounded-lg">
          <p className="text-sm font-medium">Page URL:</p>
          <code className="text-xs">/dashboard</code>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Key Performance Indicators (KPIs)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              The dashboard displays 8 animated KPI cards providing real-time system metrics:
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <Monitor className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm">Total Systems</h4>
                  <p className="text-xs text-muted-foreground">Shows the total number of registered machines</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <Wifi className="h-5 w-5 text-emerald-500 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm">Online Systems</h4>
                  <p className="text-xs text-muted-foreground">Systems currently online (connected within last 1 minute)</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <WifiOff className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm">Offline Systems</h4>
                  <p className="text-xs text-muted-foreground">Systems that are offline (not connected in last 1 minute)</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <Unlock className="h-5 w-5 text-cyan-500 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm">USB Enabled Systems</h4>
                  <p className="text-xs text-muted-foreground">Count of systems with USB access enabled</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <Lock className="h-5 w-5 text-rose-500 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm">USB Disabled Systems</h4>
                  <p className="text-xs text-muted-foreground">Count of systems with USB access disabled</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <HardDrive className="h-5 w-5 text-purple-500 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm">Total Devices</h4>
                  <p className="text-xs text-muted-foreground">Total number of USB devices registered across all systems</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <Activity className="h-5 w-5 text-indigo-500 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm">USB Events (Today)</h4>
                  <p className="text-xs text-muted-foreground">Number of USB connection/disconnection events today</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <Calendar className="h-5 w-5 text-violet-500 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm">USB Events (Last 7 Days)</h4>
                  <p className="text-xs text-muted-foreground">Total USB events in the past week</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Status Matrix</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">
              The dashboard includes a system status matrix showing:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>System names</li>
              <li>Online/Offline status with visual indicators</li>
              <li>Last connected timestamp</li>
              <li>USB status (Enabled/Disabled)</li>
              <li>Quick action buttons</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}


