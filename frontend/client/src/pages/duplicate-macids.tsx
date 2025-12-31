import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, Merge, Monitor, Users,
  Loader2, RefreshCw, CheckCircle2, XCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface DuplicateMacId {
  macId: string;
  count: number;
  systems: {
    machineId: number;
    pcName: string;
    macId: string;
    systemUserId: number | null;
    lastConnected: string | null;
    createdAt: string | null;
  }[];
}

export default function DuplicateMacIdsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [selectedDuplicate, setSelectedDuplicate] = useState<DuplicateMacId | null>(null);
  const [keepMachineId, setKeepMachineId] = useState<number | null>(null);

  const { data: duplicates, isLoading, refetch, error } = useQuery({
    queryKey: ['duplicate-macids'],
    queryFn: api.getDuplicateMacIds,
    refetchInterval: 30000,
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache
  });

  // Debug logging
  useEffect(() => {
    console.log('[DUPLICATE MAC IDS PAGE] Data:', duplicates);
    console.log('[DUPLICATE MAC IDS PAGE] Loading:', isLoading);
    console.log('[DUPLICATE MAC IDS PAGE] Error:', error);
    if (duplicates) {
      console.log('[DUPLICATE MAC IDS PAGE] Duplicates count:', duplicates.length);
      duplicates.forEach((dup, idx) => {
        console.log(`[DUPLICATE MAC IDS PAGE] Duplicate ${idx + 1}:`, dup);
      });
    }
  }, [duplicates, isLoading, error]);

  const mergeMutation = useMutation({
    mutationFn: ({ macId, keepMachineId, mergeMachineIds }: { macId: string; keepMachineId: number; mergeMachineIds: number[] }) =>
      api.mergeDuplicateMacId(macId, keepMachineId, mergeMachineIds),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['duplicate-macids'] });
      queryClient.invalidateQueries({ queryKey: ['systems'] });
      queryClient.invalidateQueries({ queryKey: ['systemUsers'] });
      setMergeDialogOpen(false);
      setSelectedDuplicate(null);
      setKeepMachineId(null);
      toast({
        title: "Success",
        description: data.message
      });
    },
    onError: (error: any) => {
      toast({
        title: "Merge failed",
        description: error.message || "Failed to merge duplicate systems",
        variant: "destructive"
      });
    }
  });

  const handleMerge = (duplicate: DuplicateMacId) => {
    setSelectedDuplicate(duplicate);
    // Pre-select the first system as default to keep
    setKeepMachineId(duplicate.systems[0].machineId);
    setMergeDialogOpen(true);
  };

  const confirmMerge = () => {
    if (!selectedDuplicate || !keepMachineId) return;

    const mergeMachineIds = selectedDuplicate.systems
      .filter(s => s.machineId !== keepMachineId)
      .map(s => s.machineId);

    if (mergeMachineIds.length === 0) {
      toast({
        title: "No systems to merge",
        description: "Please select a different system to keep",
        variant: "destructive"
      });
      return;
    }

    mergeMutation.mutate({
      macId: selectedDuplicate.macId,
      keepMachineId,
      mergeMachineIds
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              Duplicate MAC IDs
            </h1>
            <p className="text-muted-foreground mt-1">
              Detect and merge systems with duplicate MAC addresses
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Info Alert */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>About Duplicate MAC IDs</AlertTitle>
          <AlertDescription>
            When multiple systems share the same MAC ID, you can merge them into one system.
            All USB devices, USB logs, and notifications from merged systems will be transferred to the kept system.
          </AlertDescription>
        </Alert>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Loading Duplicates</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : 'Failed to load duplicate MAC IDs. Please check the browser console for details.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Duplicates List */}
        {isLoading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : duplicates && duplicates.length > 0 ? (
          <div className="space-y-4">
            {duplicates.map((duplicate) => (
              <Card key={duplicate.macId} className="border-amber-500/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        MAC ID: <code className="text-sm font-mono">{duplicate.macId}</code>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Found {duplicate.count} system{duplicate.count > 1 ? 's' : ''} with this MAC ID
                      </CardDescription>
                    </div>
                    <Badge variant="destructive" className="text-sm">
                      {duplicate.count} Duplicates
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {duplicate.systems.map((system) => (
                      <div
                        key={system.machineId}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <Monitor className="h-5 w-5 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{system.pcName}</span>
                              {system.systemUserId && (
                                <Badge variant="outline" className="text-xs">
                                  <Users className="h-3 w-3 mr-1" />
                                  System User #{system.systemUserId}
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              Machine ID: {system.machineId}
                              {system.lastConnected && (
                                <span className="ml-3">
                                  Last connected: {formatDistanceToNow(new Date(system.lastConnected), { addSuffix: true })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <Button
                      onClick={() => handleMerge(duplicate)}
                      variant="default"
                      className="w-full"
                    >
                      <Merge className="h-4 w-4 mr-2" />
                      Merge Duplicates
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-12 pb-12">
              <div className="text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-emerald-500" />
                <h3 className="text-lg font-semibold mb-2">No Duplicates Found</h3>
                <p className="text-muted-foreground">
                  All systems have unique MAC IDs. No action needed.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Merge Dialog */}
        <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Merge Duplicate Systems</DialogTitle>
              <DialogDescription>
                Select which system to keep. All other systems will be merged into it.
              </DialogDescription>
            </DialogHeader>

            {selectedDuplicate && (
              <div className="space-y-4 py-4">
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-sm font-medium mb-2">MAC ID:</p>
                  <code className="text-sm font-mono">{selectedDuplicate.macId}</code>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Select system to keep:</p>
                  {selectedDuplicate.systems.map((system) => (
                    <label
                      key={system.machineId}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${keepMachineId === system.machineId
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                        }`}
                    >
                      <input
                        type="radio"
                        name="keepSystem"
                        value={system.machineId}
                        checked={keepMachineId === system.machineId}
                        onChange={() => setKeepMachineId(system.machineId)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{system.pcName}</span>
                          {keepMachineId === system.machineId && (
                            <Badge variant="default" className="text-xs">Will Keep</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Machine ID: {system.machineId}
                          {system.systemUserId && (
                            <span className="ml-2">• System User: #{system.systemUserId}</span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Merge Action</AlertTitle>
                  <AlertDescription>
                    {selectedDuplicate.systems
                      .filter(s => s.machineId !== keepMachineId)
                      .map(s => s.pcName)
                      .join(', ')} will be merged into {selectedDuplicate.systems.find(s => s.machineId === keepMachineId)?.pcName}.
                    All USB devices, USB logs, and notifications will be transferred.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setMergeDialogOpen(false);
                  setSelectedDuplicate(null);
                  setKeepMachineId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmMerge}
                disabled={!keepMachineId || mergeMutation.isPending}
              >
                {mergeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Merge className="h-4 w-4 mr-2" />
                Merge Systems
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

