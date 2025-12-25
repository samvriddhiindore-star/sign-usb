import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BookOpen, ExternalLink } from "lucide-react";
import { Link } from "wouter";

export default function GettingStartedHelp() {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Getting Started</h1>
            <p className="text-muted-foreground mt-1">
              Learn how to access and use SIGN - USB
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Prerequisites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Modern web browser (Chrome, Firefox, Edge, Safari)</li>
              <li>Admin credentials (provided by system administrator)</li>
              <li>Network access to the SIGN - USB server</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Accessing the Application</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Open your web browser</li>
              <li>Navigate to the SIGN - USB application URL (e.g., <code className="bg-muted px-1 py-0.5 rounded">http://localhost:3000</code> or your production URL)</li>
              <li>You will be redirected to the login page if not authenticated</li>
            </ol>
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Page URL:</p>
              <code className="text-xs">/login</code>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <Link href="/help/login" className="text-sm text-primary hover:underline flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                Login & Authentication Guide
              </Link>
              <Link href="/help/dashboard" className="text-sm text-primary hover:underline flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                Dashboard Overview
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}


