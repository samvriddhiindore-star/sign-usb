import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/mockData";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, Download, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function LogsPage() {
  // In a real app, we'd have a dedicated getAllLogs endpoint
  // For mock, we'll just fetch logs for the known machines
  const { data: machines } = useQuery({ queryKey: ['machines'], queryFn: api.getMachines });
  
  // This is a bit hacky for mock data, but works for the prototype
  const { data: allLogs } = useQuery({
    queryKey: ['allLogs', machines],
    queryFn: async () => {
      if (!machines) return [];
      const promises = machines.map(m => api.getLogs(m.id));
      const results = await Promise.all(promises);
      return results.flat().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    enabled: !!machines
  });

  const [search, setSearch] = useState("");

  const filteredLogs = allLogs?.filter(log => 
    log.vendor.toLowerCase().includes(search.toLowerCase()) ||
    log.product.toLowerCase().includes(search.toLowerCase()) ||
    log.deviceId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">Comprehensive history of all USB events across the network.</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Event History</CardTitle>
                <CardDescription>View and filter security events</CardDescription>
              </div>
              <div className="flex gap-2">
                 <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search logs..." 
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Machine ID</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Device Details</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs?.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {log.machineId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {log.eventType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{log.vendor} {log.product}</span>
                          <span className="text-xs text-muted-foreground font-mono">{log.deviceId}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                         <Badge variant={log.status === 'blocked' ? 'destructive' : 'default'} className={log.status === 'allowed' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                            {log.status}
                          </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!filteredLogs || filteredLogs.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No logs found matching your criteria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
