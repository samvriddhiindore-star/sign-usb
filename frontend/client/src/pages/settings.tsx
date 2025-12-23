import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Settings, SlidersHorizontal } from "lucide-react";

export default function SettingsPage() {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground mt-1">
              Configure global preferences, notifications, and integrations.
            </p>
          </div>
        </div>

        <Alert>
          <SlidersHorizontal className="h-4 w-4" />
          <AlertTitle>Coming soon</AlertTitle>
          <AlertDescription>
            Add organization settings, notification channels, identity providers, and audit preferences here.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Suggested sections</CardTitle>
            <CardDescription>Use this layout as a placeholder until backend hooks are ready.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Organization profile and branding.</p>
            <p>• Auth providers (SSO/MFA) and password policies.</p>
            <p>• Notification channels and webhook integrations.</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

