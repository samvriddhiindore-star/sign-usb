import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, Monitor, Usb, Users, Globe, 
  ScrollText, Settings as SettingsIcon, LogOut, Menu,
  Shield, UserCog
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/systems", label: "Systems", icon: Monitor },
    { href: "/logs", label: "USB Logs", icon: Usb },
    { href: "/usb-device-control", label: "Device Registry", icon: Shield },
    { href: "/profiles", label: "Profiles", icon: Users },
    { href: "/web-access-control", label: "Website Control", icon: Globe },
    { href: "/users", label: "User Management", icon: UserCog },
    // { href: "/settings", label: "Settings", icon: SettingsIcon },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-auto border-r border-sidebar-border",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mr-3">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight block">USB Sentinel</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Admin Panel</span>
          </div>
        </div>

        <nav className="p-4 space-y-1">
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
        </nav>

        {/* User section */}
        <div className="absolute bottom-0 w-full p-4 border-t border-sidebar-border space-y-2">
          <div className="px-4 py-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Administrator</p>
            <p>admin@company.com</p>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header (Mobile Only mostly) */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-muted-foreground">
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold">USB Sentinel</span>
          </div>
          <div className="w-6" />
        </header>

        <div className="flex-1 overflow-y-auto bg-secondary/30 p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
