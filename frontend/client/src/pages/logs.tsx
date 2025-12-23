import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, UsbLog } from "@/lib/api";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Usb, Search, RefreshCw, Download, Filter,
  Clock, Monitor, HardDrive, Loader2, Activity
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export default function LogsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'Connected' | 'Removed'>('all');
  const [pcFilter, setPcFilter] = useState<string>('all');
  
  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['usb-logs'],
    queryFn: () => api.getUsbLogs(500),
    refetchInterval: 15000
  });

  // Get unique PC names for filter
  const uniquePcNames = [...new Set(logs?.map(l => l.pcName) || [])].filter(Boolean);

  // Filter logs
  const filteredLogs = logs?.filter(log => {
    const matchesSearch = 
      log.deviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.pcName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.deviceManufacturer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.devicePort?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'all' || log.status === statusFilter;
    
    const matchesPc = 
      pcFilter === 'all' || log.pcName === pcFilter;
    
    return matchesSearch && matchesStatus && matchesPc;
  }) || [];

  const handleExportCSV = () => {
    if (!filteredLogs.length) return;
    
    const headers = ['PC Name', 'Device Name', 'Manufacturer', 'Port', 'Connect Time', 'Disconnect Time', 'Duration', 'Status'];
    const rows = filteredLogs.map(log => [
      log.pcName,
      log.deviceName,
      log.deviceManufacturer || '',
      log.devicePort || '',
      log.connectTime ? format(new Date(log.connectTime), 'yyyy-MM-dd HH:mm:ss') : '',
      log.disconnectTime ? format(new Date(log.disconnectTime), 'yyyy-MM-dd HH:mm:ss') : '',
      formatDuration(log.duration),
      log.status
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usb-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Stats
  const connectedCount = logs?.filter(l => l.status === 'Connected').length || 0;
  const removedCount = logs?.filter(l => l.status === 'Removed').length || 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">USB Logs</h1>
            <p className="text-muted-foreground mt-1">View USB device activity across all systems.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportCSV} variant="outline" size="sm" disabled={!filteredLogs.length}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Events</p>
                  <p className="text-2xl font-bold">{logs?.length || 0}</p>
                </div>
                <Usb className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Currently Connected</p>
                  <p className="text-2xl font-bold text-emerald-600">{connectedCount}</p>
                </div>
                <Activity className="h-8 w-8 text-emerald-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-slate-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Removed</p>
                  <p className="text-2xl font-bold">{removedCount}</p>
                </div>
                <HardDrive className="h-8 w-8 text-slate-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unique PCs</p>
                  <p className="text-2xl font-bold">{uniquePcNames.length}</p>
                </div>
                <Monitor className="h-8 w-8 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by device, PC name, manufacturer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={pcFilter}
                  onChange={(e) => setPcFilter(e.target.value)}
                  className="px-3 py-2 border rounded-md text-sm bg-background min-w-[140px]"
                >
                  <option value="all">All PCs</option>
                  {uniquePcNames.map(pc => (
                    <option key={pc} value={pc}>{pc}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 border rounded-md text-sm bg-background"
                >
                  <option value="all">All Status</option>
                  <option value="Connected">Connected</option>
                  <option value="Removed">Removed</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Usb className="h-5 w-5" />
              USB Activity ({filteredLogs.length})
            </CardTitle>
            <CardDescription>
              Complete log of USB device connections and disconnections.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Usb className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No USB logs found</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PC Name</TableHead>
                      <TableHead>Device Name</TableHead>
                      <TableHead>Manufacturer</TableHead>
                      <TableHead>Drive</TableHead>
                      <TableHead>Connect Time</TableHead>
                      <TableHead>Disconnect Time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Monitor className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{log.pcName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Usb className="h-4 w-4 text-muted-foreground" />
                            <span className="max-w-[200px] truncate" title={log.deviceName}>
                              {log.deviceName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {log.deviceManufacturer || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {log.devicePort ? (
                            <Badge variant="outline" className="font-mono">
                              {log.devicePort}
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {log.connectTime ? (
                            <div className="text-sm">
                              <div>{format(new Date(log.connectTime), 'MMM dd, HH:mm')}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(log.connectTime), { addSuffix: true })}
                              </div>
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {log.disconnectTime ? (
                            <div className="text-sm">
                              <div>{format(new Date(log.disconnectTime), 'MMM dd, HH:mm')}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(log.disconnectTime), { addSuffix: true })}
                              </div>
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {formatDuration(log.duration)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={log.status === 'Connected' ? 'default' : 'secondary'}
                            className={log.status === 'Connected' 
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100' 
                              : ''
                            }
                          >
                            <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${
                              log.status === 'Connected' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                            }`} />
                            {log.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
