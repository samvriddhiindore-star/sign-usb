import { 
  Shield, Activity, Lock, Unlock, WifiOff, Wifi, 
  Globe, GlobeLock, Usb, Calendar, MonitorCheck
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDistanceToNow, format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: api.getDashboardStats,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const { data: usbLogs } = useQuery({
    queryKey: ['usb-logs-recent'],
    queryFn: () => api.getUsbLogs(10),
    refetchInterval: 15000
  });

  const { data: connectedDevices } = useQuery({
    queryKey: ['connected-devices'],
    queryFn: api.getConnectedUsbDevices,
    refetchInterval: 10000
  });

  if (statsLoading) {
    return (
      <Layout>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Loading your security overview...</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(9)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your USB security & system status.</p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Total Systems */}
          <Card className="border-l-4 border-l-primary bg-gradient-to-br from-background to-primary/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Systems</CardTitle>
              <MonitorCheck className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.totalSystems || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Registered machines in your network
              </p>
            </CardContent>
          </Card>

          {/* Online Systems */}
          <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-background to-emerald-500/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Online Systems</CardTitle>
              <Wifi className="h-5 w-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600">{stats?.onlineSystems || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.totalSystems ? Math.round((stats.onlineSystems / stats.totalSystems) * 100) : 0}% of fleet connected
              </p>
            </CardContent>
          </Card>

          {/* Offline Systems */}
          <Card className="border-l-4 border-l-amber-500 bg-gradient-to-br from-background to-amber-500/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Offline / Formatted</CardTitle>
              <WifiOff className="h-5 w-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{stats?.offlineSystems || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Systems not currently connected
              </p>
            </CardContent>
          </Card>

          {/* USB Enabled */}
          <Card className="border-l-4 border-l-sky-500 bg-gradient-to-br from-background to-sky-500/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">USB Enabled Systems</CardTitle>
              <Unlock className="h-5 w-5 text-sky-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-sky-600">{stats?.usbEnabledSystems || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                USB ports unlocked
              </p>
            </CardContent>
          </Card>

          {/* USB Disabled */}
          <Card className="border-l-4 border-l-rose-500 bg-gradient-to-br from-background to-rose-500/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">USB Disabled Systems</CardTitle>
              <Lock className="h-5 w-5 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-rose-600">{stats?.usbDisabledSystems || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.totalSystems ? Math.round((stats.usbDisabledSystems / stats.totalSystems) * 100) : 0}% protection coverage
              </p>
            </CardContent>
          </Card>

          {/* Blocked URLs */}
          <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-background to-purple-500/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Blocked Websites</CardTitle>
              <GlobeLock className="h-5 w-5 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{stats?.blockedUrlCount || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.allowedUrlCount || 0} allowed websites
              </p>
            </CardContent>
          </Card>

          {/* USB Events Today */}
          <Card className="border-l-4 border-l-indigo-500 bg-gradient-to-br from-background to-indigo-500/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">USB Events Today</CardTitle>
              <Usb className="h-5 w-5 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-600">{stats?.usbEventsToday || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Device connections today
              </p>
            </CardContent>
          </Card>

          {/* USB Events Last 7 Days */}
          <Card className="border-l-4 border-l-teal-500 bg-gradient-to-br from-background to-teal-500/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">USB Events (7 Days)</CardTitle>
              <Calendar className="h-5 w-5 text-teal-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-teal-600">{stats?.usbEventsLast7Days || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Weekly activity summary
              </p>
            </CardContent>
          </Card>

          {/* Currently Connected */}
          <Card className="border-l-4 border-l-orange-500 bg-gradient-to-br from-background to-orange-500/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active USB Devices</CardTitle>
              <Activity className="h-5 w-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{connectedDevices?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Currently connected devices
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Activity Panels */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          {/* Recent USB Activity */}
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Usb className="h-5 w-5" />
                Recent USB Activity
              </CardTitle>
              <CardDescription>
                Latest USB connection events across the fleet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {usbLogs && usbLogs.length > 0 ? (
                  usbLogs.slice(0, 6).map((log) => (
                    <div key={log.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        log.status === 'Connected' 
                          ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                          : 'bg-slate-100 dark:bg-slate-800'
                      }`}>
                        <Usb className={`h-5 w-5 ${
                          log.status === 'Connected' ? 'text-emerald-600' : 'text-slate-500'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {log.deviceName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {log.pcName} • {log.devicePort || 'N/A'}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={log.status === 'Connected' ? 'default' : 'secondary'} className="mb-1">
                          {log.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {log.connectTime ? formatDistanceToNow(new Date(log.connectTime), { addSuffix: true }) : 'Unknown'}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Usb className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>No recent USB activity</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Currently Connected Devices */}
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Connected Now
              </CardTitle>
              <CardDescription>
                USB devices currently plugged in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {connectedDevices && connectedDevices.length > 0 ? (
                  connectedDevices.slice(0, 5).map((device) => (
                    <div key={device.id} className="flex items-center justify-between p-2 rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <div>
                          <p className="text-sm font-medium">{device.pcName}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {device.deviceName}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {device.devicePort || 'USB'}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Shield className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No devices connected</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
