import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, DevicesByMachineReport, DeviceAnalyticsReport } from "@/lib/api";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { 
  Monitor, HardDrive, Usb, Download, RefreshCw, Loader2,
  Check, X, Wifi, WifiOff, Shield, BarChart3,
  TrendingUp, FileSpreadsheet, Calendar, ChevronRight, 
  Search, Clock, Building2
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("devices");
  const [selectedMachine, setSelectedMachine] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all");
  const { toast } = useToast();

  // Fetch all reports
  const { data: deviceReport, isLoading: loadingDevices, refetch: refetchDevices } = useQuery({
    queryKey: ['reports', 'devices-by-machine'],
    queryFn: api.getDevicesByMachineReport
  });



  const { data: deviceAnalytics, isLoading: loadingAnalytics, refetch: refetchAnalytics } = useQuery({
    queryKey: ['reports', 'device-analytics'],
    queryFn: api.getDeviceAnalyticsReport
  });

  // Fetch machine-specific device report when a machine is selected
  const { data: machineDeviceReport, isLoading: loadingMachineDevices } = useQuery({
    queryKey: ['reports', 'machine-devices', selectedMachine],
    queryFn: () => selectedMachine ? api.getMachineDeviceReport(selectedMachine) : null,
    enabled: !!selectedMachine
  });

  const handleExport = (type: 'devices' | 'usb-logs' | 'systems') => {
    const token = localStorage.getItem('token');
    let url: string;
    
    switch (type) {
      case 'devices':
        url = api.getExportDevicesUrl();
        break;
      case 'usb-logs':
        url = api.getExportUsbLogsUrl(1000);
        break;
      case 'systems':
        url = api.getExportSystemsUrl();
        break;
    }
    
    fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(response => {
        if (!response.ok) throw new Error('Export failed');
        return response.blob();
      })
      .then(blob => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${type}-report-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        a.remove();
        toast({ title: "Export successful", description: `${type} report downloaded` });
      })
      .catch(() => {
        toast({ title: "Export failed", variant: "destructive" });
      });
  };

  const handleRefreshAll = () => {
    refetchDevices();
    refetchAnalytics();
    toast({ title: "Reports refreshed" });
  };

  // Calculate summary stats
  const totalDevices = deviceReport?.reduce((sum, m) => sum + m.totalDevices, 0) || 0;
  const totalMachinesWithDevices = deviceReport?.filter(m => m.totalDevices > 0).length || 0;

  // Filter machines based on search and status
  const filteredMachines = deviceReport?.filter(machine => {
    const matchesSearch = !searchQuery || 
      machine.pcName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      machine.macId.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Use the status field from API (which includes clientStatus logic)
    const machineStatus = (machine as any).status || 'offline';
    const matchesStatus = statusFilter === 'all' || machineStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  // Get machine status - use API status field (includes clientStatus logic)
  const getMachineStatus = (machine: any) => {
    return (machine as any).status || 'offline';
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-primary" />
              Reports & Analytics
            </h1>
            <p className="text-muted-foreground mt-1">
              USB Device mapping and analytics reports
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleRefreshAll} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh All
            </Button>
            <Button onClick={() => handleExport('devices')} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export USB Devices
            </Button>
            <Button onClick={() => handleExport('usb-logs')} variant="outline" size="sm">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export USB Logs
            </Button>
            <Button onClick={() => handleExport('systems')} variant="outline" size="sm">
              <Monitor className="h-4 w-4 mr-2" />
              Export Systems
            </Button>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
        >
          <Card className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total USB Devices</p>
                  <p className="text-2xl font-bold text-purple-600">{totalDevices}</p>
                </div>
                <HardDrive className="h-6 w-6 text-purple-500 opacity-60" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Machines with Devices</p>
                  <p className="text-2xl font-bold">{totalMachinesWithDevices}</p>
                </div>
                <Monitor className="h-6 w-6 text-blue-500 opacity-60" />
              </div>
            </CardContent>
          </Card>
          {deviceAnalytics && (
            <Card className="border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Allowed USB Devices</p>
                    <p className="text-2xl font-bold text-emerald-600">{deviceAnalytics.summary.allowedDevices}</p>
                  </div>
                  <Check className="h-6 w-6 text-emerald-500 opacity-60" />
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Main Report Tabs */}
        <Tabs value={activeTab} onValueChange={(val) => {
          setActiveTab(val);
          setSelectedMachine(null);
        }}>
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="devices" className="gap-2">
              <HardDrive className="h-4 w-4" />
              USB Devices
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Devices by Machine Tab - Redesigned */}
          <TabsContent value="devices" className="space-y-4 mt-4">
            {loadingDevices ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : deviceReport?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <HardDrive className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No device data available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Search and Filter Bar */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by PC name or MAC ID..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={statusFilter === "all" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setStatusFilter("all")}
                        >
                          All
                        </Button>
                        <Button
                          variant={statusFilter === "online" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setStatusFilter("online")}
                          className="text-emerald-600"
                        >
                          <Wifi className="h-4 w-4 mr-1" />
                          Online
                        </Button>
                        <Button
                          variant={statusFilter === "offline" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setStatusFilter("offline")}
                          className="text-amber-600"
                        >
                          <WifiOff className="h-4 w-4 mr-1" />
                          Offline
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Machine Cards Grid */}
                {selectedMachine === null ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <AnimatePresence>
                      {filteredMachines.map((machine, index) => {
                        const status = getMachineStatus(machine);
                        const isOnline = status === 'online';
                        
                        return (
                          <motion.div
                            key={machine.machineId}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <Card 
                              className="cursor-pointer hover:shadow-lg transition-all duration-200 border-l-4 border-l-primary hover:border-l-primary/80"
                              onClick={() => setSelectedMachine(machine.machineId)}
                            >
                              <CardContent className="pt-6">
                                <div className="space-y-4">
                                  {/* Header */}
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                                      <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-lg truncate">{machine.pcName}</h3>
                                        <p className="text-xs text-muted-foreground truncate">{machine.macId}</p>
                                      </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                  </div>

                                  {/* Status Badge */}
                                  <div>
                                    <Badge 
                                      variant={isOnline ? "default" : "secondary"}
                                      className={isOnline 
                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100" 
                                        : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100"}
                                    >
                                      {isOnline ? (
                                        <>
                                          <Wifi className="h-3 w-3 mr-1" />
                                          Online
                                        </>
                                      ) : (
                                        <>
                                          <WifiOff className="h-3 w-3 mr-1" />
                                          Offline
                                        </>
                                      )}
                                    </Badge>
                                  </div>

                                  {/* Device Stats */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="text-muted-foreground flex items-center gap-1">
                                        <HardDrive className="h-4 w-4" />
                                        Total USB Devices
                                      </span>
                                      <span className="font-semibold">{machine.totalDevices}</span>
                                    </div>
                                    
                                    {machine.totalDevices > 0 && (
                                      <>
                                        <div className="flex items-center justify-between text-sm">
                                          <span className="text-muted-foreground flex items-center gap-1">
                                            <Check className="h-4 w-4 text-emerald-600" />
                                            Allowed
                                          </span>
                                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900">
                                            {machine.allowedDevices}
                                          </Badge>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                          <span className="text-muted-foreground flex items-center gap-1">
                                            <X className="h-4 w-4 text-rose-600" />
                                            Blocked
                                          </span>
                                          <Badge variant="destructive">
                                            {machine.blockedDevices}
                                          </Badge>
                                        </div>
                                      </>
                                    )}

                                    {/* Progress Bar */}
                                    {machine.totalDevices > 0 && (
                                      <div className="pt-2">
                                        <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-muted">
                                          {machine.allowedDevices > 0 && (
                                            <motion.div
                                              initial={{ width: 0 }}
                                              animate={{ width: `${(machine.allowedDevices / machine.totalDevices) * 100}%` }}
                                              transition={{ duration: 0.5, delay: 0.2 }}
                                              className="bg-emerald-500"
                                            />
                                          )}
                                          {machine.blockedDevices > 0 && (
                                            <motion.div
                                              initial={{ width: 0 }}
                                              animate={{ width: `${(machine.blockedDevices / machine.totalDevices) * 100}%` }}
                                              transition={{ duration: 0.5, delay: 0.3 }}
                                              className="bg-rose-500"
                                            />
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Click Hint */}
                                  <div className="pt-2 border-t">
                                    <p className="text-xs text-muted-foreground text-center">
                                      Click to view USB devices
                                    </p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                ) : (
                  /* Machine Detail View */
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedMachine(null)}
                              className="mr-2"
                            >
                              <ChevronRight className="h-4 w-4 rotate-180 mr-1" />
                              Back
                            </Button>
                            <div>
                              <CardTitle className="flex items-center gap-2">
                                <Monitor className="h-5 w-5" />
                                {deviceReport?.find(m => m.machineId === selectedMachine)?.pcName || 'Machine Details'}
                              </CardTitle>
                              <CardDescription>
                                {deviceReport?.find(m => m.machineId === selectedMachine)?.macId}
                              </CardDescription>
                            </div>
                          </div>
                          {machineDeviceReport && (
                            <div className="flex gap-2">
                              <Badge variant="outline" className="text-sm">
                                {machineDeviceReport.summary.totalDevices} USB Devices
                              </Badge>
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {loadingMachineDevices ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          </div>
                        ) : machineDeviceReport ? (
                          <div className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid gap-4 md:grid-cols-4">
                              <Card className="border-l-4 border-l-primary">
                                <CardContent className="pt-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-xs text-muted-foreground">Total USB Devices</p>
                                      <p className="text-2xl font-bold">{machineDeviceReport.summary.totalDevices}</p>
                                    </div>
                                    <HardDrive className="h-6 w-6 text-primary opacity-60" />
                                  </div>
                                </CardContent>
                              </Card>
                              <Card className="border-l-4 border-l-emerald-500">
                                <CardContent className="pt-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-xs text-muted-foreground">Allowed</p>
                                      <p className="text-2xl font-bold text-emerald-600">{machineDeviceReport.summary.allowedDevices}</p>
                                    </div>
                                    <Check className="h-6 w-6 text-emerald-500 opacity-60" />
                                  </div>
                                </CardContent>
                              </Card>
                              <Card className="border-l-4 border-l-rose-500">
                                <CardContent className="pt-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-xs text-muted-foreground">Blocked</p>
                                      <p className="text-2xl font-bold text-rose-600">{machineDeviceReport.summary.blockedDevices}</p>
                                    </div>
                                    <X className="h-6 w-6 text-rose-500 opacity-60" />
                                  </div>
                                </CardContent>
                              </Card>
                              <Card className="border-l-4 border-l-blue-500">
                                <CardContent className="pt-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-xs text-muted-foreground">Manufacturers</p>
                                      <p className="text-2xl font-bold text-blue-600">{machineDeviceReport.summary.byManufacturer?.length || 0}</p>
                                    </div>
                                    <Building2 className="h-6 w-6 text-blue-500 opacity-60" />
                                  </div>
                                </CardContent>
                              </Card>
                            </div>

                            {/* Manufacturer Breakdown */}
                            {machineDeviceReport.summary.byManufacturer && machineDeviceReport.summary.byManufacturer.length > 0 && (
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-lg flex items-center gap-2">
                                    <Building2 className="h-5 w-5" />
                                    Manufacturers
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-3">
                                    {machineDeviceReport.summary.byManufacturer.map((mfg, idx) => (
                                      <div key={idx} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                          <span className="font-medium">{mfg.manufacturer || 'Unknown'}</span>
                                          <span className="text-muted-foreground">{mfg.count} devices</span>
                                        </div>
                                        <Progress value={(mfg.count / machineDeviceReport.summary.totalDevices) * 100} className="h-2" />
                                      </div>
                                    ))}
                                  </div>
                                </CardContent>
                              </Card>
                            )}

                            {/* Devices Table */}
                            <Card>
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                  <Usb className="h-5 w-5" />
                                  All USB Devices ({machineDeviceReport.devices.length})
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="rounded-md border">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Device Name</TableHead>
                                        <TableHead>Device ID</TableHead>
                                        <TableHead>Manufacturer</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Registered</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {machineDeviceReport.devices.map((device) => (
                                        <TableRow key={device.id}>
                                          <TableCell>
                                            <div className="flex items-center gap-2">
                                              <Usb className="h-4 w-4 text-muted-foreground" />
                                              <div>
                                                <span className="font-medium">{device.deviceName}</span>
                                                {device.description && (
                                                  <p className="text-xs text-muted-foreground">{device.description}</p>
                                                )}
                                              </div>
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            {device.deviceId ? (
                                              <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-[150px] block">
                                                {device.deviceId}
                                              </code>
                                            ) : '-'}
                                          </TableCell>
                                          <TableCell>{device.deviceManufacturer || '-'}</TableCell>
                                          <TableCell>
                                            <Badge variant={device.isAllowed === 1 ? "default" : "destructive"}
                                              className={device.isAllowed === 1 
                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100' 
                                                : ''}>
                                              {device.isAllowed === 1 ? 'Allowed' : 'Blocked'}
                                            </Badge>
                                          </TableCell>
                                          <TableCell>
                                            {device.createdAt ? (
                                              <span className="text-sm text-muted-foreground flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {formatDistanceToNow(new Date(device.createdAt), { addSuffix: true })}
                                              </span>
                                            ) : '-'}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        ) : (
                          <div className="text-center py-12 text-muted-foreground">
                            <HardDrive className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            <p>No USB device data available for this machine</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Empty State */}
                {filteredMachines.length === 0 && (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Search className="h-12 w-12 mx-auto mb-3 opacity-20 text-muted-foreground" />
                      <p className="text-muted-foreground">No machines found matching your criteria</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => {
                          setSearchQuery("");
                          setStatusFilter("all");
                        }}
                      >
                        Clear Filters
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* Device Analytics Tab - Keep existing */}
          <TabsContent value="analytics" className="space-y-4 mt-4">
            {loadingAnalytics ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : deviceAnalytics && deviceAnalytics.summary ? (
              <>
                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                  <Card className="border-l-4 border-l-primary">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Total USB Devices</p>
                          <p className="text-2xl font-bold">{deviceAnalytics.summary.totalDevices}</p>
                        </div>
                        <HardDrive className="h-6 w-6 text-primary opacity-60" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-emerald-500">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Allowed</p>
                          <p className="text-2xl font-bold text-emerald-600">{deviceAnalytics.summary.allowedDevices}</p>
                        </div>
                        <Check className="h-6 w-6 text-emerald-500 opacity-60" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-rose-500">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Blocked</p>
                          <p className="text-2xl font-bold text-rose-600">{deviceAnalytics.summary.blockedDevices}</p>
                        </div>
                        <X className="h-6 w-6 text-rose-500 opacity-60" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Assigned</p>
                          <p className="text-2xl font-bold text-blue-600">{deviceAnalytics.summary.devicesWithMachines}</p>
                        </div>
                        <Monitor className="h-6 w-6 text-blue-500 opacity-60" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-amber-500">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Unassigned</p>
                          <p className="text-2xl font-bold text-amber-600">{deviceAnalytics.summary.orphanedDevices}</p>
                        </div>
                        <Shield className="h-6 w-6 text-amber-500 opacity-60" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Top Manufacturers */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Top Manufacturers
                      </CardTitle>
                      <CardDescription>Most common device manufacturers</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {deviceAnalytics.byManufacturer.slice(0, 10).map((mfg, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">{mfg.manufacturer}</span>
                              <span className="text-muted-foreground">{mfg.count} devices</span>
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                <div 
                                  className="bg-emerald-500 h-full" 
                                  style={{ width: `${(mfg.allowed / mfg.count) * 100}%` }}
                                />
                                <div 
                                  className="bg-rose-500 h-full" 
                                  style={{ width: `${(mfg.blocked / mfg.count) * 100}%` }}
                                />
                              </div>
                              <div className="flex gap-1 text-xs">
                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900">
                                  {mfg.allowed}
                                </Badge>
                                <Badge variant="destructive" className="text-xs">
                                  {mfg.blocked}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top Devices */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <HardDrive className="h-5 w-5" />
                        Most Common USB Devices
                      </CardTitle>
                      <CardDescription>USB Devices found across multiple machines</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {deviceAnalytics.topDevices.map((device, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-lg border">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{device.deviceName}</p>
                              <p className="text-xs text-muted-foreground">
                                {device.machines} machine{device.machines !== 1 ? 's' : ''} • {device.count} instance{device.count !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <Badge variant="outline">{device.count}</Badge>
                          </div>
                        ))}
                        {deviceAnalytics.topDevices.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">No device data available</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Machines with Devices */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Monitor className="h-5 w-5" />
                      Machines with USB Devices ({deviceAnalytics.byMachine.length})
                    </CardTitle>
                    <CardDescription>Detailed device breakdown by machine</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Machine</TableHead>
                            <TableHead>MAC ID</TableHead>
                            <TableHead>Total USB Devices</TableHead>
                            <TableHead>Allowed</TableHead>
                            <TableHead>Blocked</TableHead>
                            <TableHead>Last Device Added</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {deviceAnalytics.byMachine.map((machine) => (
                            <TableRow key={machine.machineId}>
                              <TableCell className="font-medium">{machine.pcName}</TableCell>
                              <TableCell>
                                <code className="text-xs bg-muted px-2 py-1 rounded">{machine.macId}</code>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{machine.totalDevices}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900">
                                  {machine.allowedDevices}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="destructive">{machine.blockedDevices}</Badge>
                              </TableCell>
                              <TableCell>
                                {machine.lastDeviceAdded ? (
                                  <span className="text-sm text-muted-foreground">
                                    {formatDistanceToNow(new Date(machine.lastDeviceAdded), { addSuffix: true })}
                                  </span>
                                ) : (
                                  <span className="text-sm text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Offline Systems with Devices */}
                {deviceAnalytics.offlineSystems && deviceAnalytics.offlineSystems.length > 0 && (
                  <Card className="border-amber-200 dark:border-amber-800">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-amber-600">
                        <WifiOff className="h-5 w-5" />
                        Offline Systems with USB Devices ({deviceAnalytics.offlineSystems.length})
                      </CardTitle>
                      <CardDescription>Systems that are offline but have registered USB devices</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {deviceAnalytics.offlineSystems.slice(0, 5).map((system) => (
                          <div key={system.machineId} className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full bg-amber-500" />
                              <div>
                                <p className="font-medium">{system.pcName}</p>
                                <p className="text-xs text-muted-foreground">{system.macId}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <Badge variant="outline">{system.totalDevices} USB devices</Badge>
                              {system.lastConnected && (
                                <span className="text-xs text-muted-foreground">
                                  Last seen: {formatDistanceToNow(new Date(system.lastConnected), { addSuffix: true })}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recent Devices */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Recent USB Devices ({deviceAnalytics.recentDevices.length})
                    </CardTitle>
                    <CardDescription>Recently registered USB devices across all machines</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Device Name</TableHead>
                            <TableHead>Machine</TableHead>
                            <TableHead>Manufacturer</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Registered</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {deviceAnalytics.recentDevices.map((device) => (
                            <TableRow key={device.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Usb className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{device.deviceName}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {device.pcName || <span className="text-muted-foreground">Unassigned</span>}
                              </TableCell>
                              <TableCell>{device.deviceManufacturer || '-'}</TableCell>
                              <TableCell>
                                <Badge variant={device.isAllowed === 1 ? "default" : "destructive"}
                                  className={device.isAllowed === 1 
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900' 
                                    : ''}>
                                  {device.isAllowed === 1 ? 'Allowed' : 'Blocked'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {device.createdAt ? (
                                  <span className="text-sm text-muted-foreground">
                                    {formatDistanceToNow(new Date(device.createdAt), { addSuffix: true })}
                                  </span>
                                ) : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : deviceAnalytics && deviceAnalytics.summary && deviceAnalytics.summary.totalDevices === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No USB device data found in device_master table</p>
                <p className="text-sm mt-2">USB Devices will appear here once they are registered in the system</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={() => refetchAnalytics()}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Failed to load analytics data</p>
                <p className="text-sm mt-2 text-destructive">Please check the browser console for errors</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={() => refetchAnalytics()}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
