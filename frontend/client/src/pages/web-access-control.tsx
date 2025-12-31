import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, UrlEntry } from "@/lib/api";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Globe, Plus, RefreshCw, MoreHorizontal,
  Edit, Trash2, Loader2, Search, Check, Upload
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function WebAccessControlPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editUrl, setEditUrl] = useState<UrlEntry | null>(null);
  const [formData, setFormData] = useState({ url: '', access: 'allowed' as 'allowed' | 'blocked' });
  const [searchTerm, setSearchTerm] = useState("");
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkUrls, setBulkUrls] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: urls, isLoading, refetch } = useQuery({
    queryKey: ['urls'],
    queryFn: api.getUrls
  });

  const createMutation = useMutation({
    mutationFn: api.createUrl,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['urls'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setIsCreateOpen(false);
      setFormData({ url: '', access: 'allowed' });
      toast({ title: "URL added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add URL", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<UrlEntry> }) =>
      api.updateUrl(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['urls'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setEditUrl(null);
      toast({ title: "URL updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update URL", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteUrl,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['urls'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({ title: "URL deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete URL", variant: "destructive" });
    }
  });

  const bulkMutation = useMutation({
    mutationFn: (urls: string[]) => api.createBulkUrls(urls),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['urls'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setIsBulkOpen(false);
      setBulkUrls("");
      toast({
        title: data.message,
        description: data.failed > 0 ? `${data.failed} URL(s) failed to add` : undefined
      });
    },
    onError: () => {
      toast({ title: "Failed to add URLs", variant: "destructive" });
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => api.deleteBulkUrls(ids),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['urls'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setSelectedIds(new Set());
      toast({ title: data.message });
    },
    onError: () => {
      toast({ title: "Failed to delete URLs", variant: "destructive" });
    }
  });

  // Filter URLs - only show allowed URLs
  const filteredUrls = urls?.filter(url => {
    const matchesSearch = url.url.toLowerCase().includes(searchTerm.toLowerCase());
    // Only show allowed URLs
    return matchesSearch && url.access === 'allowed';
  }) || [];

  const handleCreate = () => {
    if (!formData.url.trim()) return;
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!editUrl || !formData.url.trim()) return;
    updateMutation.mutate({
      id: editUrl.id,
      data: { url: formData.url, access: 'allowed' }
    });
  };

  const openEditDialog = (url: UrlEntry) => {
    setFormData({ url: url.url, access: 'allowed' });
    setEditUrl(url);
  };

  const handleBulkAdd = () => {
    const urlList = bulkUrls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);
    if (urlList.length === 0) return;
    bulkMutation.mutate(urlList);
  };

  const bulkUrlCount = bulkUrls
    .split('\n')
    .map((url: string) => url.trim())
    .filter((url: string) => url.length > 0).length;

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredUrls.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUrls.map(u => u.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    bulkDeleteMutation.mutate(Array.from(selectedIds));
  };

  // Stats - only count allowed URLs
  const allowedCount = urls?.filter(u => u.access === 'allowed').length || 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Website Access Control</h1>
            <p className="text-muted-foreground mt-1">Manage allowed websites.</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setFormData({ url: '', access: 'allowed' })}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add URL
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Website</DialogTitle>
                  <DialogDescription>
                    Add a new URL to allow.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="url">Website URL</Label>
                    <Input
                      id="url"
                      value={formData.url}
                      onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="e.g., example.com"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={createMutation.isPending || !formData.url.trim()}
                  >
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Add URL
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={() => setBulkUrls('')}>
                  <Upload className="h-4 w-4 mr-2" />
                  Bulk Add
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Bulk Add Websites</DialogTitle>
                  <DialogDescription>
                    Paste multiple URLs, one per line.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="bulk-urls">URLs (one per line)</Label>
                    <Textarea
                      id="bulk-urls"
                      value={bulkUrls}
                      onChange={(e) => setBulkUrls(e.target.value)}
                      placeholder={"google.com\nyahoo.com\nbing.com"}
                      rows={8}
                    />
                    {bulkUrlCount > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {bulkUrlCount} URL(s) will be added
                      </p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsBulkOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleBulkAdd}
                    disabled={bulkMutation.isPending || bulkUrlCount === 0}
                  >
                    {bulkMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Add {bulkUrlCount} URL(s)
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
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Allowed URLs</p>
                  <p className="text-2xl font-bold">{allowedCount}</p>
                </div>
                <Globe className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Rules</p>
                  <p className="text-2xl font-bold text-emerald-600">{allowedCount}</p>
                </div>
                <Check className="h-8 w-8 text-emerald-500 opacity-50" />
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
                  placeholder="Search allowed URLs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* URLs Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Allowed Websites ({filteredUrls.length})
                </CardTitle>
                <CardDescription>
                  Manage allowed websites.
                </CardDescription>
              </div>
              {selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteMutation.isPending}
                >
                  {bulkDeleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedIds.size})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredUrls.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No URLs found</p>
                <p className="text-sm mt-1">Add your first URL to get started</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedIds.size === filteredUrls.length && filteredUrls.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Access</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUrls.map((url) => (
                      <TableRow key={url.id} className="hover:bg-muted/50">
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(url.id)}
                            onCheckedChange={() => toggleSelect(url.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-emerald-500" />
                            <span className="font-medium">{url.url}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="default"
                            className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100"
                          >
                            <Check className="h-3 w-3 mr-1" /> Allowed
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {url.createdAt ? (
                            <span className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(url.createdAt), { addSuffix: true })}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(url)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => deleteMutation.mutate(url.id)}
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
        <Dialog open={!!editUrl} onOpenChange={(open) => !open && setEditUrl(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit URL</DialogTitle>
              <DialogDescription>
                Update URL details.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-url">Website URL</Label>
                <Input
                  id="edit-url"
                  value={formData.url}
                  onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditUrl(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={updateMutation.isPending || !formData.url.trim()}
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
