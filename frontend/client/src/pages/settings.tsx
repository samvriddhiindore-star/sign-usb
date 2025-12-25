import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, UserCog, SlidersHorizontal } from "lucide-react";
import { PortalUsersContent } from "@/pages/users";

export default function SettingsPage() {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    // Check for tab query parameter
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'portal-users') {
      setActiveTab('portal-users');
    }
  }, [location]);

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
              Configure global preferences, notifications, and user management.
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="portal-users">
              <UserCog className="h-4 w-4 mr-2" />
              Portal Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Configure global preferences and system settings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    General settings configuration will be available here.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="portal-users" className="mt-6">
            <PortalUsersContent />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

