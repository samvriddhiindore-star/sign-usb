import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, DeviceEntry, System } from "@/lib/api";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { 
  Usb, Plus, RefreshCw, MoreHorizontal, Edit, Trash2,
  Loader2, Search, Monitor, Check, X, HardDrive, Shield
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function UsbDeviceControlPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<DeviceEntry | null>(null);
  const [formData, setFormData] = useState({
    machineId: '' as string,
    deviceName: '',
    description: '',
    deviceId: '',
    deviceManufacturer: '',
    remark: '',
    isAllowed: 1
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [machineFilter, setMachineFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'allowed' | 'blocked'>('all');
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: devices, isLoading, refetch } = useQuery({
    queryKey: ['devices'],
    queryFn: api.getDevices
  });

  const { data: systems } = useQuery({
    queryKey: ['systems'],
    queryFn: api.getSystems
  });

  // Get unique PC names for filter
  const uniquePcNames = [...new Set(devices?.map(d => d.pcName).filter(Boolean) || [])];

  const createMutation = useMutation({
    mutationFn: api.createDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setIsCreateOpen(false);
      resetForm();
      toast({ title: "Device registered successfully" });
    },
    onError: () => {
      toast({ title: "Failed to register device", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DeviceEntry> }) =>
      api.updateDevice(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setEditDevice(null);
      toast({ title: "Device updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update device", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast({ title: "Device deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete device", variant: "destructive" });
    }
  });

  const toggleAllowedMutation = useMutation({
    mutationFn: ({ id, isAllowed }: { id: number; isAllowed: number }) =>
      api.updateDevice(id, { isAllowed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast({ title: "Device status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update device status", variant: "destructive" });
    }
  });

  const resetForm = () => {
    setFormData({
      machineId: '',
      deviceName: '',
      description: '',
      deviceId: '',
      deviceManufacturer: '',
      remark: '',
      isAllowed: 1
    });
  };

  // Filter devices
  const filteredDevices = devices?.filter(device => {
    const matchesSearch = 
      device.deviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.deviceId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.deviceManufacturer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.pcName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesMachine = 
      machineFilter === 'all' || 
      (machineFilter === 'none' && !device.machineId) ||
      device.pcName === machineFilter;
    
    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'allowed' && device.isAllowed === 1) ||
      (statusFilter === 'blocked' && device.isAllowed === 0);
    
    return matchesSearch && matchesMachine && matchesStatus;
  }) || [];

  const handleCreate = () => {
    if (!formData.deviceName.trim()) return;
    createMutation.mutate({
      machineId: formData.machineId ? parseInt(formData.machineId) : null,
      deviceName: formData.deviceName,
      description: formData.description || undefined,
      deviceId: formData.deviceId || undefined,
      deviceManufacturer: formData.deviceManufacturer || undefined,
      remark: formData.remark || undefined,
      isAllowed: formData.isAllowed
    });
  };

  const handleUpdate = () => {
    if (!editDevice || !formData.deviceName.trim()) return;
    updateMutation.mutate({ 
      id: editDevice.id, 
      data: {
        machineId: formData.machineId ? parseInt(formData.machineId) : null,
        deviceName: formData.deviceName,
        description: formData.description,
        deviceId: formData.deviceId,
        deviceManufacturer: formData.deviceManufacturer,
        remark: formData.remark,
        isAllowed: formData.isAllowed
      }
    });
  };

  const openEditDialog = (device: DeviceEntry) => {
    setFormData({
      machineId: device.machineId?.toString() || '',
      deviceName: device.deviceName,
      description: device.description || '',
      deviceId: device.deviceId || '',
      deviceManufacturer: device.deviceManufacturer || '',
      remark: device.remark || '',
      isAllowed: device.isAllowed ?? 1
    });
    setEditDevice(device);
  };

  // Stats
  const allowedCount = devices?.filter(d => d.isAllowed === 1).length || 0;
  const blockedCount = devices?.filter(d => d.isAllowed === 0).length || 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">USB Device Registry</h1>
            <p className="text-muted-foreground mt-1">Manage system-wide USB device whitelist and blacklist.</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Register Device
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Register USB Device</DialogTitle>
                  <DialogDescription>
                    Add a new USB device to the system registry.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-2">
                    <Label htmlFor="deviceName">Device Name *</Label>
                    <Input
                      id="deviceName"
                      value={formData.deviceName}
                      onChange={(e) => setFormData(prev => ({ ...prev, deviceName: e.target.value }))}
                      placeholder="e.g., SanDisk Cruzer Blade"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="machineId">Assign to System</Label>
                    <Select 
                      value={formData.machineId} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, machineId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a system (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No specific system</SelectItem>
                        {systems?.map(s => (
                          <SelectItem key={s.machineId} value={s.machineId.toString()}>
                            {s.pcName} ({s.macId})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deviceId">Device ID</Label>
                    <Input
                      id="deviceId"
                      value={formData.deviceId}
                      onChange={(e) => setFormData(prev => ({ ...prev, deviceId: e.target.value }))}
                      placeholder="e.g., USB\\VID_0781&PID_5567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deviceManufacturer">Manufacturer</Label>
                    <Input
                      id="deviceManufacturer"
                      value={formData.deviceManufacturer}
                      onChange={(e) => setFormData(prev => ({ ...prev, deviceManufacturer: e.target.value }))}
                      placeholder="e.g., SanDisk"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="e.g., 16GB USB Flash Drive"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="remark">Remark</Label>
                    <Textarea
                      id="remark"
                      value={formData.remark}
                      onChange={(e) => setFormData(prev => ({ ...prev, remark: e.target.value }))}
                      placeholder="Additional notes..."
                      rows={2}
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div className="space-y-0.5">
                      <Label>Access Status</Label>
                      <p className="text-sm text-muted-foreground">
                        {formData.isAllowed === 1 ? 'This device is allowed' : 'This device is blocked'}
                      </p>
                    </div>
                    <Switch
                      checked={formData.isAllowed === 1}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isAllowed: checked ? 1 : 0 }))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreate} 
                    disabled={createMutation.isPending || !formData.deviceName.trim()}
                  >
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Register Device
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Devices</p>
                  <p className="text-2xl font-bold">{devices?.length || 0}</p>
                </div>
                <HardDrive className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Allowed</p>
                  <p className="text-2xl font-bold text-emerald-600">{allowedCount}</p>
                </div>
                <Check className="h-8 w-8 text-emerald-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-rose-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Blocked</p>
                  <p className="text-2xl font-bold text-rose-600">{blockedCount}</p>
                </div>
                <X className="h-8 w-8 text-rose-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Assigned Systems</p>
                  <p className="text-2xl font-bold text-purple-600">{uniquePcNames.length}</p>
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
                  placeholder="Search by device name, ID, manufacturer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <select
                  value={machineFilter}
                  onChange={(e) => setMachineFilter(e.target.value)}
                  className="px-3 py-2 border rounded-md text-sm bg-background min-w-[140px]"
                >
                  <option value="all">All Systems</option>
                  <option value="none">No System</option>
                  {uniquePcNames.map(pc => (
                    <option key={pc} value={pc!}>{pc}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 border rounded-md text-sm bg-background"
                >
                  <option value="all">All Status</option>
                  <option value="allowed">Allowed</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Devices Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Usb className="h-5 w-5" />
              Registered Devices ({filteredDevices.length})
            </CardTitle>
            <CardDescription>
              System-wide USB device registry for access control.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredDevices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <HardDrive className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No devices found</p>
                <p className="text-sm mt-1">Register your first USB device to get started</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device Name</TableHead>
                      <TableHead>Device ID</TableHead>
                      <TableHead>Manufacturer</TableHead>
                      <TableHead>System</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Remark</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDevices.map((device) => (
                      <TableRow key={device.id} className="hover:bg-muted/50">
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
                            <code className="text-xs bg-muted px-2 py-1 rounded max-w-[150px] truncate block">
                              {device.deviceId}
                            </code>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{device.deviceManufacturer || '-'}</span>
                        </TableCell>
                        <TableCell>
                          {device.pcName ? (
                            <Badge variant="outline" className="gap-1">
                              <Monitor className="h-3 w-3" />
                              {device.pcName}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">Global</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={device.isAllowed === 1 ? "default" : "destructive"}
                            className={`cursor-pointer ${device.isAllowed === 1 
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100 hover:bg-emerald-200' 
                              : 'hover:bg-rose-700'
                            }`}
                            onClick={() => toggleAllowedMutation.mutate({
                              id: device.id,
                              isAllowed: device.isAllowed === 1 ? 0 : 1
                            })}
                          >
                            {device.isAllowed === 1 ? (
                              <><Check className="h-3 w-3 mr-1" /> Allowed</>
                            ) : (
                              <><X className="h-3 w-3 mr-1" /> Blocked</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground max-w-[150px] truncate block">
                            {device.remark || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(device)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => toggleAllowedMutation.mutate({
                                  id: device.id,
                                  isAllowed: device.isAllowed === 1 ? 0 : 1
                                })}
                              >
                                {device.isAllowed === 1 ? (
                                  <><X className="h-4 w-4 mr-2" />Block</>
                                ) : (
                                  <><Check className="h-4 w-4 mr-2" />Allow</>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => deleteMutation.mutate(device.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
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

        {/* Edit Dialog */}
        <Dialog open={!!editDevice} onOpenChange={(open) => !open && setEditDevice(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Device</DialogTitle>
              <DialogDescription>
                Update device information.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="edit-deviceName">Device Name *</Label>
                <Input
                  id="edit-deviceName"
                  value={formData.deviceName}
                  onChange={(e) => setFormData(prev => ({ ...prev, deviceName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-machineId">Assign to System</Label>
                <Select 
                  value={formData.machineId} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, machineId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a system" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No specific system</SelectItem>
                    {systems?.map(s => (
                      <SelectItem key={s.machineId} value={s.machineId.toString()}>
                        {s.pcName} ({s.macId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-deviceId">Device ID</Label>
                <Input
                  id="edit-deviceId"
                  value={formData.deviceId}
                  onChange={(e) => setFormData(prev => ({ ...prev, deviceId: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-deviceManufacturer">Manufacturer</Label>
                <Input
                  id="edit-deviceManufacturer"
                  value={formData.deviceManufacturer}
                  onChange={(e) => setFormData(prev => ({ ...prev, deviceManufacturer: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-remark">Remark</Label>
                <Textarea
                  id="edit-remark"
                  value={formData.remark}
                  onChange={(e) => setFormData(prev => ({ ...prev, remark: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label>Access Status</Label>
                  <p className="text-sm text-muted-foreground">
                    {formData.isAllowed === 1 ? 'This device is allowed' : 'This device is blocked'}
                  </p>
                </div>
                <Switch
                  checked={formData.isAllowed === 1}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isAllowed: checked ? 1 : 0 }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDevice(null)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpdate} 
                disabled={updateMutation.isPending || !formData.deviceName.trim()}
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
