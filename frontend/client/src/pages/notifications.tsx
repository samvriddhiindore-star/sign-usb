import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, SystemNotification } from "@/lib/api";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Bell, Check, CheckCheck, AlertCircle, Info, 
  Monitor, Loader2, RefreshCw
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function NotificationIcon({ type }: { type: string }) {
  switch (type) {
    case 'pc_name_changed':
      return <AlertCircle className="h-5 w-5 text-amber-500" />;
    case 'system_registered':
      return <Monitor className="h-5 w-5 text-blue-500" />;
    default:
      return <Info className="h-5 w-5 text-gray-500" />;
  }
}

function NotificationItem({ notification }: { notification: SystemNotification }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const markAsReadMutation = useMutation({
    mutationFn: () => api.markNotificationAsRead(notification.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
    onError: () => {
      toast({ title: "Failed to mark notification as read", variant: "destructive" });
    }
  });

  const handleMarkAsRead = () => {
    if (notification.isRead === 0) {
      markAsReadMutation.mutate();
    }
  };

  return (
    <div
      className={cn(
        "p-4 rounded-lg border transition-all hover:shadow-md",
        notification.isRead === 0
          ? "bg-card border-primary/20 shadow-sm"
          : "bg-muted/30 border-border"
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-1">
          <NotificationIcon type={notification.notificationType} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className={cn(
                  "font-semibold text-sm",
                  notification.isRead === 0 ? "text-foreground" : "text-muted-foreground"
                )}>
                  {notification.title}
                </h4>
                {notification.isRead === 0 && (
                  <Badge variant="default" className="h-5 px-1.5 text-xs">
                    New
                  </Badge>
                )}
              </div>
              
              <p className={cn(
                "text-sm mb-2",
                notification.isRead === 0 ? "text-foreground" : "text-muted-foreground"
              )}>
                {notification.message}
              </p>

              {notification.oldValue && notification.newValue && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <span className="line-through">{notification.oldValue}</span>
                  <span>→</span>
                  <span className="font-medium text-foreground">{notification.newValue}</span>
                </div>
              )}

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {notification.macId && (
                  <span className="font-mono">{notification.macId}</span>
                )}
                {notification.createdAt && (
                  <span>{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}</span>
                )}
                {notification.machineId && (
                  <Link 
                    href={`/machines/${notification.machineId}`}
                    className="text-primary hover:underline"
                  >
                    View System
                  </Link>
                )}
              </div>
            </div>

            {notification.isRead === 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAsRead}
                disabled={markAsReadMutation.isPending}
                className="flex-shrink-0"
              >
                {markAsReadMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: notifications, isLoading, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.getNotifications(100, false),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: unreadCount } = useQuery({
    queryKey: ['unread-count'],
    queryFn: api.getUnreadNotificationCount,
    refetchInterval: 30000,
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: api.markAllNotificationsAsRead,
    onSuccess: (affected) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      toast({ 
        title: `Marked ${affected} notification${affected !== 1 ? 's' : ''} as read` 
      });
    },
    onError: () => {
      toast({ title: "Failed to mark all as read", variant: "destructive" });
    }
  });

  const unreadNotifications = notifications?.filter(n => n.isRead === 0) || [];
  const readNotifications = notifications?.filter(n => n.isRead === 1) || [];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Bell className="h-8 w-8" />
              Notifications
            </h1>
            <p className="text-muted-foreground mt-1">
              System events and PC name change alerts
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            {unreadNotifications.length > 0 && (
              <Button
                onClick={() => markAllAsReadMutation.mutate()}
                variant="outline"
                size="sm"
                disabled={markAllAsReadMutation.isPending}
              >
                {markAllAsReadMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCheck className="h-4 w-4 mr-2" />
                )}
                Mark All Read
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{notifications?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Unread</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{unreadCount || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Read</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">{readNotifications.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Notifications List */}
        {isLoading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : notifications && notifications.length > 0 ? (
          <div className="space-y-6">
            {/* Unread Notifications */}
            {unreadNotifications.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Badge variant="default" className="h-5 px-2">
                    {unreadNotifications.length}
                  </Badge>
                  Unread Notifications
                </h2>
                <div className="space-y-3">
                  {unreadNotifications.map((notification) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))}
                </div>
              </div>
            )}

            {/* Read Notifications */}
            {readNotifications.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
                  Read Notifications
                </h2>
                <div className="space-y-3">
                  {readNotifications.map((notification) => (
                    <NotificationItem key={notification.id} notification={notification} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-12 pb-12">
              <div className="text-center">
                <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-20" />
                <h3 className="text-lg font-semibold mb-2">No notifications</h3>
                <p className="text-muted-foreground">
                  You're all caught up! New system events will appear here.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

