import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Machine } from "@/lib/api";
import Layout from "@/components/Layout";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Search, Computer, Loader2, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function MachinesPage() {
  const { data: machines, isLoading } = useQuery({
    queryKey: ['machines'],
    queryFn: api.getMachines
  });

  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: ({ id, lockAllUsb }: { id: string, lockAllUsb: boolean }) => 
      api.updatePolicy(id, { lockAllUsb }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      toast({
        title: "Policy Updated",
        description: "Machine USB policy has been successfully updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update policy. Please try again.",
        variant: "destructive"
      });
    }
  });

  const filteredMachines = machines?.filter(m => 
    m.hostname.toLowerCase().includes(search.toLowerCase()) ||
    m.osVersion.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Machines</h1>
            <p className="text-muted-foreground mt-1">Manage registered endpoints and USB policies.</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search hostname or OS..." 
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[250px]">Hostname</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>OS Version</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead className="text-right">Lock USB</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <div className="flex items-center justify-center text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading machines...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredMachines?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No machines found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMachines?.map((machine) => (
                    <TableRow key={machine.id}>
                      <TableCell className="font-medium">
                        <Link href={`/machines/${machine.id}`}>
                          <div className="flex items-center gap-3 cursor-pointer hover:text-primary transition-colors">
                            <div className="h-8 w-8 rounded bg-secondary flex items-center justify-center text-muted-foreground">
                              <Computer className="h-4 w-4" />
                            </div>
                            <span data-testid={`machine-name-${machine.id}`}>{machine.hostname}</span>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={machine.status === 'online' ? 'default' : 'secondary'} className={machine.status === 'online' ? 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 border-emerald-200' : ''}>
                          {machine.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{machine.osVersion}</TableCell>
                      <TableCell>{machine.agentVersion}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(machine.lastSeenAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch 
                          checked={machine.policy?.lockAllUsb || false}
                          onCheckedChange={(checked) => toggleMutation.mutate({ id: machine.id, lockAllUsb: checked })}
                          data-testid={`switch-lock-${machine.id}`}
                          disabled={!machine.policy}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
