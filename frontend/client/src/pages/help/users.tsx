import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default function UsersHelp() {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Portal Users</h1>
            <p className="text-muted-foreground mt-1">Managing portal users and their permissions</p>
          </div>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-sm font-medium">Page URL:</p>
          <code className="text-xs">/users</code>
        </div>
        <Card>
          <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>Manage portal users, their roles, and access permissions.</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
