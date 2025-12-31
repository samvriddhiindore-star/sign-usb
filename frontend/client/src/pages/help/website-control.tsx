import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BookOpen, AlertCircle, CheckCircle, Globe, Shield } from "lucide-react";

export default function WebsiteControlHelp() {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Website Access Control</h1>
            <p className="text-muted-foreground mt-1">Managing allowed website URLs</p>
          </div>
        </div>
        <div className="p-3 bg-muted rounded-lg inline-block">
          <p className="text-sm font-medium">Page URL:</p>
          <code className="text-xs">/web-access-control</code>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed">
              The Website Access Control module allows administrators to define a whitelist of URLs that authorized users can access.
              This ensures that systems operate within a secure boundary, preventing access to unauthorized or potentially harmful websites.
            </p>

            <div className="mt-4 border rounded-lg overflow-hidden shadow-sm">
              <img
                src="/web-access-control.png"
                alt="Website Access Control Interface"
                className="w-full h-auto object-cover"
              />
              <div className="p-2 bg-muted/50 text-xs text-center text-muted-foreground">
                Figure 1: The Website Access Control management interface
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Security Policy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                  <span>Only URLs explicitly listed here are allowed.</span>
                </li>
                <li className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>All other websites are blocked by default.</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Key Features</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Add individual URLs</li>
                <li>Bulk import multiple URLs at once</li>
                <li>Delete single or multiple entries</li>
                <li>Search and filter allowed list</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>How to Manage URLs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Adding a URL</h3>
              <p className="text-sm text-muted-foreground">
                Click the <span className="font-medium text-foreground">"+ Add URL"</span> button. Enter the full URL (e.g., https://example.com) and click Save.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Bulk Operations</h3>
              <p className="text-sm text-muted-foreground">
                Use the <span className="font-medium text-foreground">"Bulk Add"</span> button to paste a list of URLs (one per line).
                To remove multiple URLs, select the checkboxes next to them and click <span className="font-medium text-destructive">"Delete Selected"</span>.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
