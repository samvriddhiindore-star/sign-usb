import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, ExternalLink } from "lucide-react";
import { Link } from "wouter";

export default function LoginHelp() {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Login & Authentication</h1>
            <p className="text-muted-foreground mt-1">
              How to log in and manage your session
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Logging In</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold mb-2">1. Navigate to Login Page</h3>
                <p className="text-sm text-muted-foreground">
                  If not already on the login page, the application will redirect you automatically.
                  The login page displays the SIGN - USB logo and login form.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">2. Enter Credentials</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li><strong>Email</strong>: Enter your admin email address</li>
                  <li><strong>Password</strong>: Enter your password</li>
                  <li>Click the "Sign In" button or press Enter</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">3. Successful Login</h3>
                <p className="text-sm text-muted-foreground">
                  Upon successful authentication, you'll be redirected to the Dashboard.
                  A success notification will appear briefly. Your session will remain active until you log out.
                </p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Page URLs:</p>
              <ul className="text-xs space-y-1 mt-1">
                <li>Login: <code>/login</code></li>
                <li>Dashboard: <code>/dashboard</code></li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Logging Out</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Click on your profile/user menu in the top-right corner (if available)</li>
              <li>Select "Logout" or click the logout button in the sidebar</li>
              <li>You will be redirected to the login page</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}








