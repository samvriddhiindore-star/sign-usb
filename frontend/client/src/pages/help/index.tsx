import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BookOpen, ExternalLink, HelpCircle } from "lucide-react";
import { Link } from "wouter";

export default function HelpIndex() {
  const helpSections = [
    { href: "/help/getting-started", title: "Getting Started", description: "Learn how to access and use SIGN - USB" },
    { href: "/help/login", title: "Login & Authentication", description: "How to log in and manage your session" },
    { href: "/help/dashboard", title: "Dashboard Overview", description: "Understanding your system's health and security status" },
    { href: "/help/machines", title: "Machine Management", description: "Managing registered systems and their USB access" },
    { href: "/help/system-users", title: "System User Management", description: "Creating and assigning USB access policies" },
    { href: "/help/users", title: "Portal Users", description: "Managing portal users and their permissions" },
    { href: "/help/reports", title: "Reports & Analytics", description: "Comprehensive device and activity reports" },
    { href: "/help/website-control", title: "Website Access Control", description: "Managing allowed website URLs" },
    { href: "/help/logs", title: "USB Activity Logs", description: "Tracking USB device connections and disconnections" },
    { href: "/help/settings", title: "Settings", description: "Application configuration and preferences" },
    { href: "/help/troubleshooting", title: "Troubleshooting", description: "Common issues and solutions" },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <HelpCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Help & Documentation</h1>
            <p className="text-muted-foreground mt-1">
              Complete guide to using SIGN - USB
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {helpSections.map((section) => (
            <Link key={section.href} href={section.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    {section.title}
                  </CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              <Link href="/dashboard" className="text-sm text-primary hover:underline flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                Go to Dashboard
              </Link>
              <Link href="/systems" className="text-sm text-primary hover:underline flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                View Systems
              </Link>
              <Link href="/reports" className="text-sm text-primary hover:underline flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                View Reports
              </Link>
              <Link href="/system-users" className="text-sm text-primary hover:underline flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                Manage System Users
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}


