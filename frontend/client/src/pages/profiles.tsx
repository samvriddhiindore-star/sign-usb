import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, Profile, System } from "@/lib/api";
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

export default function ProfilesPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({ 
    profileName: '', 
    description: '',
    usbPolicy: 0
  });
  const [addMachineDialogOpen, setAddMachineDialogOpen] = useState(false);
  const [selectedProfileForMachine, setSelectedProfileForMachine] = useState<Profile | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: profiles, isLoading, refetch } = useQuery({
    queryKey: ['profiles'],
    queryFn: api.getProfiles
  });

  const { data: systems } = useQuery({
    queryKey: ['systems'],
    queryFn: api.getSystems
  });

  // Get unassigned machines
  const unassignedMachines = systems?.filter(s => !s.profileId) || [];

  const createMutation = useMutation({
    mutationFn: api.createProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setIsCreateOpen(false);
      setFormData({ profileName: '', description: '', usbPolicy: 0 });
      toast({ title: "Profile created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create profile", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Profile> }) =>
      api.updateProfile(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setEditProfile(null);
      toast({ title: "Profile updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['systems'] });
      toast({ title: "Profile deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete profile", variant: "destructive" });
    }
  });

  const applyPolicyMutation = useMutation({
    mutationFn: api.applyProfilePolicy,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['systems'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({ title: `USB policy applied to ${data.affected} machines` });
    },
    onError: () => {
      toast({ title: "Failed to apply policy", variant: "destructive" });
    }
  });

  const assignMachineMutation = useMutation({
    mutationFn: ({ machineId, profileId }: { machineId: number; profileId: number | null }) =>
      api.assignProfileToSystem(machineId, profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
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
    if (!formData.profileName.trim()) return;
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!editProfile || !formData.profileName.trim()) return;
    updateMutation.mutate({ 
      id: editProfile.profileId, 
      data: {
        profileName: formData.profileName,
        description: formData.description,
        usbPolicy: formData.usbPolicy
      }
    });
  };

  const openEditDialog = (profile: Profile) => {
    setFormData({ 
      profileName: profile.profileName, 
      description: profile.description || '',
      usbPolicy: profile.usbPolicy || 0
    });
    setEditProfile(profile);
  };

  const openAddMachineDialog = (profile: Profile) => {
    setSelectedProfileForMachine(profile);
    setSelectedMachineId('');
    setAddMachineDialogOpen(true);
  };

  const handleAddMachine = () => {
    if (!selectedProfileForMachine || !selectedMachineId) return;
    assignMachineMutation.mutate({
      machineId: parseInt(selectedMachineId),
      profileId: selectedProfileForMachine.profileId
    });
  };

  const handleRemoveMachine = (machineId: number) => {
    assignMachineMutation.mutate({ machineId, profileId: null });
  };

  // Stats
  const totalAssigned = profiles?.reduce((sum, p) => sum + p.assignedCount, 0) || 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Profiles</h1>
            <p className="text-muted-foreground mt-1">Create and manage system profiles with USB policies.</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setFormData({ profileName: '', description: '', usbPolicy: 0 })}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Profile
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Profile</DialogTitle>
                  <DialogDescription>
                    Create a new profile to group systems with similar USB policies.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Profile Name</Label>
                    <Input
                      id="name"
                      value={formData.profileName}
                      onChange={(e) => setFormData(prev => ({ ...prev, profileName: e.target.value }))}
                      placeholder="e.g., Finance Department"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Brief description of this profile..."
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div className="space-y-0.5">
                      <Label>USB Policy</Label>
                      <p className="text-sm text-muted-foreground">
                        {formData.usbPolicy === 1 ? 'USB ports enabled for this profile' : 'USB ports disabled for this profile'}
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
                    disabled={createMutation.isPending || !formData.profileName.trim()}
                  >
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Profile
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
                  <p className="text-sm text-muted-foreground">Total Profiles</p>
                  <p className="text-2xl font-bold">{profiles?.length || 0}</p>
                </div>
                <Users className="h-8 w-8 text-primary opacity-50" />
                  </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Profiles</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {profiles?.filter(p => p.isActive === 1).length || 0}
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

        {/* Profiles List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Profiles
            </CardTitle>
            <CardDescription>
              Click on a profile to expand and see assigned machines.
            </CardDescription>
              </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !profiles || profiles.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No profiles found</p>
                <p className="text-sm mt-1">Create your first profile to get started</p>
              </div>
            ) : (
              <Accordion type="single" collapsible className="space-y-2">
                {profiles.map((profile) => (
                  <AccordionItem 
                    key={profile.profileId} 
                    value={profile.profileId.toString()}
                    className="border rounded-lg px-4"
                  >
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div className="text-left">
                            <p className="font-medium">{profile.profileName}</p>
                            <p className="text-sm text-muted-foreground">
                              {profile.description || 'No description'}
                            </p>
                          </div>
                  </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={profile.usbPolicy === 1 ? "outline" : "destructive"} className="gap-1">
                            {profile.usbPolicy === 1 ? (
                              <><Unlock className="h-3 w-3" /> USB Enabled</>
                            ) : (
                              <><Lock className="h-3 w-3" /> USB Disabled</>
                            )}
                          </Badge>
                          <Badge variant="secondary">
                            <Monitor className="h-3 w-3 mr-1" />
                            {profile.assignedCount} machines
                          </Badge>
                </div>
                  </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <div className="pt-2 space-y-4">
                        {/* Profile Actions */}
                        <div className="flex gap-2 flex-wrap">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openAddMachineDialog(profile)}
                            disabled={unassignedMachines.length === 0}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Machine
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => applyPolicyMutation.mutate(profile.profileId)}
                            disabled={applyPolicyMutation.isPending || profile.assignedCount === 0}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Apply USB Policy
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openEditDialog(profile)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteMutation.mutate(profile.profileId)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                </div>

                        {/* Assigned Machines */}
                        {profile.machines.length > 0 ? (
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
                                {profile.machines.map((machine) => (
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
                                        variant={machine.machineOn === 1 ? "default" : "secondary"}
                                        className={machine.machineOn === 1 
                                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100" 
                                          : ""
                                        }
                                      >
                                        {machine.machineOn === 1 ? (
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
                            <p className="text-sm">No machines assigned to this profile</p>
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
        <Dialog open={!!editProfile} onOpenChange={(open) => !open && setEditProfile(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogDescription>
                Update profile details and USB policy.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Profile Name</Label>
                <Input
                  id="edit-name"
                  value={formData.profileName}
                  onChange={(e) => setFormData(prev => ({ ...prev, profileName: e.target.value }))}
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
                    {formData.usbPolicy === 1 ? 'USB ports enabled for this profile' : 'USB ports disabled for this profile'}
                  </p>
                </div>
                <Switch
                  checked={formData.usbPolicy === 1}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, usbPolicy: checked ? 1 : 0 }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditProfile(null)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpdate} 
                disabled={updateMutation.isPending || !formData.profileName.trim()}
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
              <DialogTitle>Add Machine to Profile</DialogTitle>
              <DialogDescription>
                Assign a machine to "{selectedProfileForMachine?.profileName}"
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
