import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { api } from "@/lib/api";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Lock, Unlock, Clock, ArrowLeft, ShieldAlert, Usb, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function MachineDetailPage() {
  const [, params] = useRoute("/machines/:id");
  const id = params?.id || "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: machine, isLoading: loadingMachine } = useQuery({
    queryKey: ['machine', id],
    queryFn: () => api.getMachine(id),
    enabled: !!id
  });

  const { data: logs, isLoading: loadingLogs } = useQuery({
    queryKey: ['logs', id],
    queryFn: () => api.getLogs(id),
    enabled: !!id
  });

  const updatePolicy = useMutation({
    mutationFn: (policy: { lockAllUsb: boolean; temporarilyUnlockedUntil?: string | null }) => 
      api.updatePolicy(id, policy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machine', id] });
      toast({ title: "Policy Updated", description: "New USB policy applied successfully." });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to update policy. Please try again.",
        variant: "destructive"
      });
    }
  });

  if (loadingMachine) return <Layout><div className="p-8">Loading...</div></Layout>;
  if (!machine) return <Layout><div className="p-8">Machine not found</div></Layout>;

  const isLocked = machine.policy?.lockAllUsb || false;
  const tempUnlock = machine.policy?.temporarilyUnlockedUntil;
  const isTempUnlocked = tempUnlock && new Date(tempUnlock) > new Date();

  return (
    <Layout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <Button variant="ghost" className="pl-0 hover:bg-transparent hover:text-primary" onClick={() => setLocation('/machines')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Machines
        </Button>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              {machine.hostname}
              <Badge variant={machine.status === 'online' ? 'default' : 'secondary'}>
                {machine.status}
              </Badge>
            </h1>
            <div className="mt-2 text-muted-foreground flex items-center gap-4 text-sm">
              <span>{machine.osVersion}</span>
              <span>•</span>
              <span>Agent v{machine.agentVersion}</span>
              <span>•</span>
              <span>ID: {machine.id}</span>
            </div>
          </div>

          <Card className="w-full md:w-auto min-w-[300px] border-primary/10 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`p-3 rounded-full ${isLocked && !isTempUnlocked ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-600'}`}>
                {isLocked && !isTempUnlocked ? <Lock className="h-6 w-6" /> : <Unlock className="h-6 w-6" />}
              </div>
              <div>
                <div className="font-medium">Current Policy</div>
                <div className="text-sm text-muted-foreground">
                  {isTempUnlocked 
                    ? `Unlocked until ${format(new Date(tempUnlock!), 'HH:mm')}` 
                    : isLocked 
                      ? "USB Ports Locked" 
                      : "USB Ports Open"}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Controls Column */}
          <div className="md:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Policy Controls</CardTitle>
                <CardDescription>Manage USB access for this device</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full justify-start" 
                  variant={isLocked ? "destructive" : "outline"}
                  onClick={() => updatePolicy.mutate({ lockAllUsb: true, temporarilyUnlockedUntil: null })}
                  disabled={isLocked && !isTempUnlocked}
                >
                  <Lock className="mr-2 h-4 w-4" /> Lock All USB
                </Button>
                
                <Button 
                  className="w-full justify-start" 
                  variant={!isLocked ? "default" : "outline"}
                  onClick={() => updatePolicy.mutate({ lockAllUsb: false, temporarilyUnlockedUntil: null })}
                  disabled={!isLocked}
                >
                  <Unlock className="mr-2 h-4 w-4" /> Unlock Permanently
                </Button>
                
                <Separator className="my-2" />
                
                <Button 
                  className="w-full justify-start" 
                  variant="secondary"
                  onClick={() => {
                    const unlockTime = new Date(Date.now() + 30 * 60000).toISOString();
                    updatePolicy.mutate({ lockAllUsb: true, temporarilyUnlockedUntil: unlockTime });
                  }}
                >
                  <Clock className="mr-2 h-4 w-4" /> Unlock for 30 Mins
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Device Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Blocked Events (24h)</span>
                  <span className="font-mono font-bold">12</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Last Sync</span>
                  <span className="text-sm">{format(new Date(machine.lastSeenAt), 'HH:mm:ss')}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Logs Column */}
          <div className="md:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  USB Event Logs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(log.createdAt), 'MMM dd HH:mm')}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{log.eventType}</span>
                            <span className="text-xs text-muted-foreground">{log.vendor} {log.product}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {log.deviceId}
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.status === 'blocked' ? 'destructive' : 'outline'} className="text-[10px]">
                            {log.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!logs || logs.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No USB activity recorded.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
