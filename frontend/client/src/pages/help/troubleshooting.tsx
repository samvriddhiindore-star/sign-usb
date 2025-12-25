import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, AlertCircle } from "lucide-react";

export default function TroubleshootingHelp() {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Troubleshooting</h1>
            <p className="text-muted-foreground mt-1">Common issues and solutions</p>
          </div>
        </div>
        <Card>
          <CardHeader><CardTitle>Common Issues</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Cannot Log In</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Verify email and password are correct</li>
                <li>Check if account is active (not inactive)</li>
                <li>Clear browser cache and cookies</li>
                <li>Try different browser</li>
                <li>Contact administrator if issue persists</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Dashboard Not Loading</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Check internet connection</li>
                <li>Refresh the page (F5 or Ctrl+R)</li>
                <li>Check browser console for errors</li>
                <li>Verify server is running</li>
                <li>Clear browser cache</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Machines Showing as Offline</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Verify machines are actually running</li>
                <li>Check if machines have network connectivity</li>
                <li>Verify agent/service is running on machines</li>
                <li>System is offline if last_connected &gt; 1 minute ago</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
