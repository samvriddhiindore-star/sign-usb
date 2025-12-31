import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, SystemUser, System } from "@/lib/api";
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
  DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger
} from "@/components/ui/accordion";
import { 
  Users, Plus, RefreshCw, MoreHorizontal, Edit, Trash2,
  Loader2, Shield, Monitor, Lock, Unlock, Usb, Play,
  Wifi, WifiOff, UserMinus
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function SystemUsersPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editSystemUser, setEditSystemUser] = useState<SystemUser | null>(null);
  const [formData, setFormData] = useState({ 
    systemUserName: '', 
    description: '',
    usbPolicy: 0
  });
  const [addMachineDialogOpen, setAddMachineDialogOpen] = useState(false);
  const [selectedSystemUserForMachine, setSelectedSystemUserForMachine] = useState<SystemUser | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: systemUsers, isLoading, refetch } = useQuery({
    queryKey: ['system-users'],
    queryFn: api.getSystemUsers
  });

  const { data: systems } = useQuery({
    queryKey: ['systems'],
    queryFn: api.getSystems
  });

  // Get unassigned machines
  const unassignedMachines = systems?.filter(s => !s.systemUserId) || [];

  const createMutation = useMutation({
    mutationFn: (data: { systemUserName: string; description?: string; usbPolicy?: number }) => 
      api.createSystemUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-users'] });
      setIsCreateOpen(false);
      setFormData({ systemUserName: '', description: '', usbPolicy: 0 });
      toast({ title: "System user created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to create system user", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { systemUserName?: string; description?: string; usbPolicy?: number } }) =>
      api.updateSystemUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-users'] });
      setEditSystemUser(null);
      toast({ title: "System user updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to update system user", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteSystemUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-users'] });
      queryClient.invalidateQueries({ queryKey: ['systems'] });
      toast({ title: "System user deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete system user", variant: "destructive" });
    }
  });

  const applyPolicyMutation = useMutation({
    mutationFn: api.applySystemUserPolicy,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['system-users'] });
      queryClient.invalidateQueries({ queryKey: ['systems'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({ title: `USB policy applied to ${data.affected} machines` });
    },
    onError: () => {
      toast({ title: "Failed to apply policy", variant: "destructive" });
    }
  });

  const assignMachineMutation = useMutation({
    mutationFn: ({ machineId, systemUserId }: { machineId: number; systemUserId: number | null }) =>
      api.assignSystemUserToSystem(machineId, systemUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-users'] });
      queryClient.invalidateQueries({ queryKey: ['systems'] });
      setAddMachineDialogOpen(false);
      setSelectedMachineId('');
      toast({ title: "Machine assigned successfully" });
    },
    onError: () => {
      toast({ title: "Failed to assign machine", variant: "destructive" });
    }
  });

  const handleCreate = () => {
    if (!formData.systemUserName.trim()) return;
    const payload: { systemUserName: string; description?: string; usbPolicy: number } = {
      systemUserName: formData.systemUserName.trim(),
      usbPolicy: formData.usbPolicy ?? 0
    };
    if (formData.description.trim()) {
      payload.description = formData.description.trim();
    }
    console.log("Creating system user with payload:", payload);
    createMutation.mutate(payload);
  };

  const handleUpdate = () => {
    if (!editSystemUser || !formData.systemUserName.trim()) return;
    updateMutation.mutate({ 
      id: editSystemUser.systemUserId, 
      data: {
        systemUserName: formData.systemUserName.trim(),
        description: formData.description.trim() || undefined,
        usbPolicy: formData.usbPolicy
      }
    });
  };

  const openEditDialog = (systemUser: SystemUser) => {
    setFormData({ 
      systemUserName: systemUser.systemUserName, 
      description: systemUser.description || '',
      usbPolicy: systemUser.usbPolicy || 0
    });
    setEditSystemUser(systemUser);
  };

  const openAddMachineDialog = (systemUser: SystemUser) => {
    setSelectedSystemUserForMachine(systemUser);
    setSelectedMachineId('');
    setAddMachineDialogOpen(true);
  };

  const handleAddMachine = () => {
    if (!selectedSystemUserForMachine || !selectedMachineId) return;
    assignMachineMutation.mutate({
      machineId: parseInt(selectedMachineId),
      systemUserId: selectedSystemUserForMachine.systemUserId
    });
  };

  const handleRemoveMachine = (machineId: number) => {
    assignMachineMutation.mutate({ machineId, systemUserId: null });
  };

  // Stats
  const totalAssigned = systemUsers?.reduce((sum, su) => sum + su.assignedCount, 0) || 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">System Users</h1>
            <p className="text-muted-foreground mt-1">Create and manage system users with USB policies.</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setFormData({ systemUserName: '', description: '', usbPolicy: 0 })}>
                  <Plus className="h-4 w-4 mr-2" />
                  New SystemUser
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create System User</DialogTitle>
                  <DialogDescription>
                    Create a new system user to group systems with similar USB policies.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">SystemUser Name</Label>
                    <Input
                      id="name"
                      value={formData.systemUserName}
                      onChange={(e) => setFormData(prev => ({ ...prev, systemUserName: e.target.value }))}
                      placeholder="e.g., Finance Department"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Brief description of this systemUser..."
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div className="space-y-0.5">
                      <Label>USB Policy</Label>
                      <p className="text-sm text-muted-foreground">
                        {formData.usbPolicy === 1 ? 'USB ports enabled for this systemUser' : 'USB ports disabled for this systemUser'}
                      </p>
                </div>
                    <Switch
                      checked={formData.usbPolicy === 1}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, usbPolicy: checked ? 1 : 0 }))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreate} 
                    disabled={createMutation.isPending || !formData.systemUserName.trim()}
                  >
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create SystemUser
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
                  <p className="text-sm text-muted-foreground">Total SystemUsers</p>
                  <p className="text-2xl font-bold">{systemUsers?.length || 0}</p>
                </div>
                <Users className="h-8 w-8 text-primary opacity-50" />
                  </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active SystemUsers</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {systemUsers?.filter(p => p.isActive === 1).length || 0}
                  </p>
                </div>
                <Shield className="h-8 w-8 text-emerald-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Assigned Systems</p>
                  <p className="text-2xl font-bold text-purple-600">{totalAssigned}</p>
                </div>
                <Monitor className="h-8 w-8 text-purple-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unassigned</p>
                  <p className="text-2xl font-bold text-amber-600">{unassignedMachines.length}</p>
                </div>
                <Monitor className="h-8 w-8 text-amber-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SystemUsers List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All SystemUsers
            </CardTitle>
            <CardDescription>
              Click on a systemUser to expand and see assigned machines.
            </CardDescription>
              </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !systemUsers || systemUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No systemUsers found</p>
                <p className="text-sm mt-1">Create your first systemUser to get started</p>
              </div>
            ) : (
              <Accordion type="single" collapsible className="space-y-2">
                {systemUsers.map((systemUser) => (
                  <AccordionItem 
                    key={systemUser.systemUserId} 
                    value={systemUser.systemUserId.toString()}
                    className="border rounded-lg px-4"
                  >
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div className="text-left">
                            <p className="font-medium">{systemUser.systemUserName}</p>
                            <p className="text-sm text-muted-foreground">
                              {systemUser.description || 'No description'}
                            </p>
                          </div>
                  </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={systemUser.usbPolicy === 1 ? "outline" : "destructive"} className="gap-1">
                            {systemUser.usbPolicy === 1 ? (
                              <><Unlock className="h-3 w-3" /> USB Enabled</>
                            ) : (
                              <><Lock className="h-3 w-3" /> USB Disabled</>
                            )}
                          </Badge>
                          <Badge variant="secondary">
                            <Monitor className="h-3 w-3 mr-1" />
                            {systemUser.assignedCount} machines
                          </Badge>
                </div>
                  </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <div className="pt-2 space-y-4">
                        {/* SystemUser Actions */}
                        <div className="flex gap-2 flex-wrap">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openAddMachineDialog(systemUser)}
                            disabled={unassignedMachines.length === 0}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Machine
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => applyPolicyMutation.mutate(systemUser.systemUserId)}
                            disabled={applyPolicyMutation.isPending || systemUser.assignedCount === 0}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Apply USB Policy
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openEditDialog(systemUser)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteMutation.mutate(systemUser.systemUserId)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                </div>

                        {/* Assigned Machines */}
                        {systemUser.machines.length > 0 ? (
                          <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                                  <TableHead>PC Name</TableHead>
                                  <TableHead>MAC ID</TableHead>
                        <TableHead>Status</TableHead>
                                  <TableHead>USB</TableHead>
                                  <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                                {systemUser.machines.map((machine) => (
                                  <TableRow key={machine.machineId}>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <Monitor className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">{machine.pcName}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <code className="text-xs bg-muted px-2 py-1 rounded">
                                        {machine.macId}
                                      </code>
                                    </TableCell>
                                    <TableCell>
                                      <Badge 
                                        variant={(machine.status || 'offline') === 'online' ? "default" : "secondary"}
                                        className={(machine.status || 'offline') === 'online' 
                                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100" 
                                          : ""
                                        }
                                      >
                                        {(machine.status || 'offline') === 'online' ? (
                                          <><Wifi className="h-3 w-3 mr-1" /> Online</>
                                        ) : (
                                          <><WifiOff className="h-3 w-3 mr-1" /> Offline</>
                                        )}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Badge 
                                        variant={machine.usbStatus === 1 ? "outline" : "destructive"}
                                        className={machine.usbStatus === 1 
                                          ? "border-sky-500 text-sky-700 dark:text-sky-400" 
                                          : ""
                                        }
                                      >
                                        {machine.usbStatus === 1 ? 'Enabled' : 'Disabled'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveMachine(machine.machineId)}
                                        className="text-destructive hover:text-destructive"
                                      >
                                        <UserMinus className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                      </TableRow>
                                ))}
                    </TableBody>
                  </Table>
                </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground border rounded-md">
                            <Monitor className="h-8 w-8 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">No machines assigned to this systemUser</p>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
              </CardContent>
            </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editSystemUser} onOpenChange={(open) => !open && setEditSystemUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit SystemUser</DialogTitle>
              <DialogDescription>
                Update systemUser details and USB policy.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">SystemUser Name</Label>
                <Input
                  id="edit-name"
                  value={formData.systemUserName}
                  onChange={(e) => setFormData(prev => ({ ...prev, systemUserName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label>USB Policy</Label>
                  <p className="text-sm text-muted-foreground">
                    {formData.usbPolicy === 1 ? 'USB ports enabled for this systemUser' : 'USB ports disabled for this systemUser'}
                  </p>
                </div>
                <Switch
                  checked={formData.usbPolicy === 1}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, usbPolicy: checked ? 1 : 0 }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditSystemUser(null)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpdate} 
                disabled={updateMutation.isPending || !formData.systemUserName.trim()}
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Machine Dialog */}
        <Dialog open={addMachineDialogOpen} onOpenChange={setAddMachineDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Machine to SystemUser</DialogTitle>
              <DialogDescription>
                Assign a machine to "{selectedSystemUserForMachine?.systemUserName}"
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="machine-select">Select Machine</Label>
              <Select value={selectedMachineId} onValueChange={setSelectedMachineId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Choose a machine..." />
                </SelectTrigger>
                <SelectContent>
                  {unassignedMachines.length === 0 ? (
                    <SelectItem value="none" disabled>No unassigned machines</SelectItem>
                  ) : (
                    unassignedMachines.map(machine => (
                      <SelectItem key={machine.machineId} value={machine.machineId.toString()}>
                        {machine.pcName} ({machine.macId})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddMachineDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddMachine}
                disabled={assignMachineMutation.isPending || !selectedMachineId}
              >
                {assignMachineMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Machine
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
