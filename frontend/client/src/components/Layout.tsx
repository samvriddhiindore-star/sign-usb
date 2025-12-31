import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, Monitor, Usb, Users, Globe, 
  ScrollText, Settings as SettingsIcon, LogOut, Menu,
  Shield, UserCog, BarChart3, HelpCircle, ChevronDown, ChevronRight,
  Bell, AlertTriangle, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Notification Badge Component
function NotificationBadge() {
  const { data: unreadCount } = useQuery({
    queryKey: ['unread-count'],
    queryFn: api.getUnreadNotificationCount,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  if (!unreadCount || unreadCount === 0) return null;

  return (
    <Badge 
      variant="destructive" 
      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs font-bold"
    >
      {unreadCount > 99 ? '99+' : unreadCount}
    </Badge>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isHelpActive = location.startsWith('/help');
  const [helpMenuOpen, setHelpMenuOpen] = useState(isHelpActive);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Get user info from localStorage
  const [userInfo, setUserInfo] = useState<{ name: string; email: string; role: string } | null>(null);

  // Sync duplicate MAC IDs mutation
  const syncDuplicatesMutation = useMutation({
    mutationFn: api.syncDuplicateMacIds,
    onSuccess: (data) => {
      toast({
        title: "Sync Complete",
        description: data.message || `Successfully merged ${data.merged} duplicate system(s)`,
      });
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['systems'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-macids'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync duplicate MAC IDs",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (isHelpActive) {
      setHelpMenuOpen(true);
    }
    
    // Load user info from localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUserInfo(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse user info:', e);
      }
    }
  }, [isHelpActive]);

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/systems", label: "Systems", icon: Monitor },
    { href: "/logs", label: "USB Logs", icon: Usb },
    { href: "/reports", label: "Reports", icon: BarChart3 },
    { href: "/system-users", label: "System Users", icon: Users },
    { href: "/web-access-control", label: "Website Control", icon: Globe },
    // Duplicate MAC IDs page removed - duplicates are now automatically merged
    // { href: "/duplicate-macids", label: "Duplicate MAC IDs", icon: AlertTriangle },
  ];

  const helpMenuItems = [
    { href: "/help", label: "Help Home", icon: HelpCircle },
    { href: "/help/getting-started", label: "Getting Started", icon: null },
    { href: "/help/login", label: "Login & Authentication", icon: null },
    { href: "/help/dashboard", label: "Dashboard", icon: null },
    { href: "/help/machines", label: "Machine Management", icon: null },
    { href: "/help/system-users", label: "System User Management", icon: null },
    { href: "/help/users", label: "Portal Users", icon: null },
    { href: "/help/reports", label: "Reports & Analytics", icon: null },
    { href: "/help/website-control", label: "Website Control", icon: null },
    { href: "/help/logs", label: "USB Activity Logs", icon: null },
    { href: "/help/settings", label: "Settings", icon: null },
    { href: "/help/troubleshooting", label: "Troubleshooting", icon: null },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - Fixed */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground transform transition-transform duration-200 ease-in-out lg:translate-x-0 border-r border-sidebar-border flex flex-col",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border flex-shrink-0">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mr-3">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight block">SIGN - USB</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Admin Panel</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href || location.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  "flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}>
                  <item.icon className={cn("h-5 w-5 mr-3", isActive && "animate-pulse")} />
                  {item.label}
                </div>
              </Link>
            );
          })}

          {/* Help Menu */}
          <div className="mt-2">
            <button
              onClick={() => setHelpMenuOpen(!helpMenuOpen)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                isHelpActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <div className="flex items-center">
                <HelpCircle className={cn("h-5 w-5 mr-3", isHelpActive && "animate-pulse")} />
                Help
              </div>
              {helpMenuOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            
            {helpMenuOpen && (
              <div className="ml-4 mt-1 space-y-1 border-l-2 border-sidebar-border pl-2">
                {helpMenuItems.map((item) => {
                  const isActive = location === item.href;
                  const IconComponent = item.icon;
                  return (
                    <Link key={item.href} href={item.href}>
                      <div className={cn(
                        "flex items-center px-3 py-2 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer",
                        isActive
                          ? "bg-primary/20 text-primary-foreground"
                          : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}>
                        {IconComponent && <IconComponent className="h-3 w-3 mr-2" />}
                        {!IconComponent && <span className="w-3 h-3 mr-2" />}
                        {item.label}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

      </aside>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden lg:ml-64">
        {/* Top Header Bar - Fixed */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 md:px-6 fixed top-0 right-0 left-0 lg:left-64 z-30">
          {/* Left side - Mobile menu button */}
          <button 
            onClick={() => setSidebarOpen(true)} 
            className="p-2 -ml-2 text-muted-foreground lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
          
          {/* Center - Logo (mobile only) */}
          <div className="flex items-center gap-2 lg:hidden">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold">SIGN - USB</span>
          </div>
          
          {/* Right side - Sync, Notifications and User account */}
          <div className="ml-auto flex items-center gap-3">
            {/* Sync Button */}
            <button
              onClick={() => syncDuplicatesMutation.mutate()}
              disabled={syncDuplicatesMutation.isPending}
              className="relative p-2 rounded-full hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Sync and merge duplicate MAC IDs"
            >
              {syncDuplicatesMutation.isPending ? (
                <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />
              ) : (
                <RefreshCw className="h-5 w-5 text-muted-foreground" />
              )}
            </button>

            {/* Notifications Bell */}
            <Link href="/notifications">
              <button className="relative p-2 rounded-full hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <NotificationBadge />
              </button>
            </Link>

            {/* User account dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center p-1 rounded-full hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                  <Avatar className="h-9 w-9 cursor-pointer">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {userInfo?.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{userInfo?.name || 'User'}</p>
                    <p className="text-xs text-muted-foreground">{userInfo?.email || 'user@example.com'}</p>
                    <p className="text-xs text-muted-foreground capitalize">{userInfo?.role || 'user'}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-secondary/30 p-4 md:p-8 mt-16">
          {children}
        </div>
      </main>
    </div>
  );
}
