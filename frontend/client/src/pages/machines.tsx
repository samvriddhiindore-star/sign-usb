import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, System, SystemUser } from "@/lib/api";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub,
  DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Monitor, Wifi, WifiOff, Usb, Lock, Unlock,
  Search, MoreHorizontal, Eye,
  Users, Loader2, UserPlus, AlertTriangle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function MachinesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [usbFilter, setUsbFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [systemUserFilter, setSystemUserFilter] = useState<string>('all');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedSystemUserId, setSelectedSystemUserId] = useState<string>('');

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: systems, isLoading } = useQuery({
    queryKey: ['systems'],
    queryFn: api.getSystems,
    refetchInterval: 15000,
    staleTime: 0, // Always consider data stale to force refetch
    gcTime: 0 // Don't cache data
  });

  const { data: systemUsers } = useQuery({
    queryKey: ['systemUsers'],
    queryFn: api.getSystemUsers
  });

  const { data: duplicates } = useQuery({
    queryKey: ['duplicate-macids'],
    queryFn: api.getDuplicateMacIds,
    staleTime: 60000, // Cache for 1 minute
  });

  // Create a map of MAC IDs to duplicate count for quick lookup
  const duplicateMacIdMap = new Map<string, number>();
  duplicates?.forEach(dup => {
    duplicateMacIdMap.set(dup.macId, dup.count);
  });

  const updateUsbMutation = useMutation({
    mutationFn: ({ machineId, enabled }: { machineId: number; enabled: boolean }) =>
      api.updateSystemUsb(machineId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systems'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({ title: "USB status updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update USB status", variant: "destructive" });
    }
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: ({ machineIds, enabled }: { machineIds: number[]; enabled: boolean }) =>
      api.bulkUpdateUsb(machineIds, enabled),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['systems'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setSelectedIds([]);
      toast({ title: `USB updated for ${data.affected} systems` });
    },
    onError: () => {
      toast({ title: "Bulk update failed", variant: "destructive" });
    }
  });

  const assignSystemUserMutation = useMutation({
    mutationFn: ({ machineId, systemUserId }: { machineId: number; systemUserId: number | null }) =>
      api.assignSystemUserToSystem(machineId, systemUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systems'] });
      queryClient.invalidateQueries({ queryKey: ['systemUsers'] });
      toast({ title: "SystemUser assigned successfully" });
    },
    onError: () => {
      toast({ title: "Failed to assign systemUser", variant: "destructive" });
    }
  });

  const bulkAssignSystemUserMutation = useMutation({
    mutationFn: ({ machineIds, systemUserId }: { machineIds: number[]; systemUserId: number | null }) =>
      api.bulkAssignSystemUser(machineIds, systemUserId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['systems'] });
      queryClient.invalidateQueries({ queryKey: ['systemUsers'] });
      setSelectedIds([]);
      setAssignDialogOpen(false);
      toast({ title: `SystemUser assigned to ${data.affected} systems` });
    },
    onError: () => {
      toast({ title: "Failed to assign systemUser", variant: "destructive" });
    }
  });

  // Filter systems
  const filteredSystems = systems?.filter(system => {
    const matchesSearch =
      system.pcName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      system.macId.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'online' && system.status === 'online') ||
      (statusFilter === 'offline' && system.status === 'offline');

    // Debug logging for offline systems
    if (statusFilter === 'offline' && system.status === 'offline') {
      console.log(`[FRONTEND DEBUG] Offline system found:`, {
        machineId: system.machineId,
        pcName: system.pcName,
        status: system.status,
        machineOn: system.machineOn,
        lastConnected: system.lastConnected
      });
    }

    const matchesUsb =
      usbFilter === 'all' ||
      (usbFilter === 'enabled' && system.usbStatus === 1) ||
      (usbFilter === 'disabled' && system.usbStatus === 0);

    const matchesSystemUser =
      systemUserFilter === 'all' ||
      (systemUserFilter === 'none' && !system.systemUserId) ||
      (system.systemUserId?.toString() === systemUserFilter);

    return matchesSearch && matchesStatus && matchesUsb && matchesSystemUser;
  }) || [];

  // Debug: Log all systems with their status
  if (systems && systems.length > 0) {
    const offlineCount = systems.filter(s => s.status === 'offline').length;
    const onlineCount = systems.filter(s => s.status === 'online').length;
    console.log(`[FRONTEND] Systems status: Total: ${systems.length}, Online: ${onlineCount}, Offline: ${offlineCount}`);
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredSystems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSystems.map(s => s.machineId));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkEnable = () => {
    if (selectedIds.length === 0) return;
    bulkUpdateMutation.mutate({ machineIds: selectedIds, enabled: true });
  };

  const handleBulkDisable = () => {
    if (selectedIds.length === 0) return;
    bulkUpdateMutation.mutate({ machineIds: selectedIds, enabled: false });
  };

  const handleBulkAssignSystemUser = () => {
    if (selectedIds.length === 0) return;
    const systemUserId = selectedSystemUserId === 'none' ? null : parseInt(selectedSystemUserId);
    bulkAssignSystemUserMutation.mutate({ machineIds: selectedIds, systemUserId });
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Systems</h1>
            <p className="text-muted-foreground mt-1">Manage and control all registered machines.</p>
          </div>
          <div className="flex gap-2">
            {duplicates && duplicates.length > 0 && (
              <Link href="/duplicate-macids">
                <Button variant="destructive" size="sm">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  {duplicates.length} Duplicate{duplicates.length > 1 ? 's' : ''}
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Filters & Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by PC name or MAC ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 border rounded-md text-sm bg-background"
                >
                  <option value="all">All Status</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                </select>
                <select
                  value={usbFilter}
                  onChange={(e) => setUsbFilter(e.target.value as any)}
                  className="px-3 py-2 border rounded-md text-sm bg-background"
                >
                  <option value="all">All USB</option>
                  <option value="enabled">USB Enabled</option>
                  <option value="disabled">USB Disabled</option>
                </select>
                <select
                  value={systemUserFilter}
                  onChange={(e) => setSystemUserFilter(e.target.value)}
                  className="px-3 py-2 border rounded-md text-sm bg-background min-w-[140px]"
                >
                  <option value="all">All SystemUsers</option>
                  <option value="none">No SystemUser</option>
                  {systemUsers?.map(p => (
                    <option key={p.systemUserId} value={p.systemUserId.toString()}>{p.systemUserName}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions Bar */}
        {selectedIds.length > 0 && (
          <Card className="border-primary bg-primary/5">
            <CardContent className="py-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-medium">
                  {selectedIds.length} system{selectedIds.length > 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkEnable}
                    disabled={bulkUpdateMutation.isPending}
                  >
                    <Unlock className="h-4 w-4 mr-1" />
                    Enable USB
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkDisable}
                    disabled={bulkUpdateMutation.isPending}
                  >
                    <Lock className="h-4 w-4 mr-1" />
                    Disable USB
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAssignDialogOpen(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Assign SystemUser
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedIds([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Systems Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Systems ({filteredSystems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSystems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Monitor className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No systems found</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.length === filteredSystems.length && filteredSystems.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>PC Name</TableHead>
                      <TableHead>MAC ID</TableHead>
                      <TableHead>SystemUser</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>USB</TableHead>
                      <TableHead>Last Connected</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSystems.map((system) => (
                      <TableRow key={system.machineId} className="hover:bg-muted/50">
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(system.machineId)}
                            onCheckedChange={() => toggleSelect(system.machineId)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Monitor className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{system.pcName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {system.macId}
                            </code>
                            {duplicateMacIdMap.has(system.macId) && duplicateMacIdMap.get(system.macId)! > 1 && (
                              <Link href="/duplicate-macids">
                                <Badge
                                  variant="destructive"
                                  className="cursor-pointer hover:bg-destructive/90 text-xs"
                                  title={`${duplicateMacIdMap.get(system.macId)} systems share this MAC ID`}
                                >
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Duplicate
                                </Badge>
                              </Link>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {system.systemUser ? (
                            <Badge variant="outline" className="gap-1">
                              <Users className="h-3 w-3" />
                              {system.systemUser.systemUserName}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={system.status === 'online' ? "default" : "secondary"}
                            className={system.status === 'online'
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100"
                              : ""
                            }
                          >
                            {system.status === 'online' ? (
                              <><Wifi className="h-3 w-3 mr-1" /> Online</>
                            ) : (
                              <><WifiOff className="h-3 w-3 mr-1" /> Offline</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={system.usbStatus === 1 ? "outline" : "destructive"}
                            className={system.usbStatus === 1
                              ? "border-sky-500 text-sky-700 dark:text-sky-400"
                              : ""
                            }
                          >
                            {system.usbStatus === 1 ? (
                              <><Unlock className="h-3 w-3 mr-1" /> Enabled</>
                            ) : (
                              <><Lock className="h-3 w-3 mr-1" /> Disabled</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {system.lastConnected ? (
                            <span className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(system.lastConnected), { addSuffix: true })}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Never</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/machines/${system.machineId}`}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => updateUsbMutation.mutate({
                                  machineId: system.machineId,
                                  enabled: true
                                })}
                                disabled={system.usbStatus === 1}
                              >
                                <Unlock className="h-4 w-4 mr-2" />
                                Enable USB
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => updateUsbMutation.mutate({
                                  machineId: system.machineId,
                                  enabled: false
                                })}
                                disabled={system.usbStatus === 0}
                              >
                                <Lock className="h-4 w-4 mr-2" />
                                Disable USB
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  <Users className="h-4 w-4 mr-2" />
                                  Assign SystemUser
                                </DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                  <DropdownMenuSubContent>
                                    <DropdownMenuItem
                                      onClick={() => assignSystemUserMutation.mutate({
                                        machineId: system.machineId,
                                        systemUserId: null
                                      })}
                                    >
                                      <span className="text-muted-foreground">No SystemUser</span>
                                    </DropdownMenuItem>
                                    {systemUsers?.map(systemUser => (
                                      <DropdownMenuItem
                                        key={systemUser.systemUserId}
                                        onClick={() => assignSystemUserMutation.mutate({
                                          machineId: system.machineId,
                                          systemUserId: systemUser.systemUserId
                                        })}
                                      >
                                        {systemUser.systemUserName}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                              </DropdownMenuSub>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bulk Assign SystemUser Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign SystemUser</DialogTitle>
              <DialogDescription>
                Assign a systemUser to {selectedIds.length} selected system{selectedIds.length > 1 ? 's' : ''}.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="systemUser-select">Select SystemUser</Label>
              <Select value={selectedSystemUserId} onValueChange={setSelectedSystemUserId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Choose a systemUser..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No SystemUser (Remove)</SelectItem>
                  {systemUsers?.map(systemUser => (
                    <SelectItem key={systemUser.systemUserId} value={systemUser.systemUserId.toString()}>
                      {systemUser.systemUserName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleBulkAssignSystemUser}
                disabled={bulkAssignSystemUserMutation.isPending || !selectedSystemUserId}
              >
                {bulkAssignSystemUserMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Assign SystemUser
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
