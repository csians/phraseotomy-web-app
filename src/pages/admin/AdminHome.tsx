import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Key } from "lucide-react";

const AdminHome = () => {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Phraseotomy Admin</h1>
          <p className="text-muted-foreground mt-2">Manage your app settings and license codes</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                License Codes
              </CardTitle>
              <CardDescription>
                Manage 6-digit license codes for your customers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/admin/codes">
                <Button className="w-full">Manage Codes</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminHome;
