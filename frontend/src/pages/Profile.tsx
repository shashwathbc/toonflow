import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/nav/Navbar";
import Footer from "@/components/nav/Footer";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, LogOut, Save } from "lucide-react";

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState({
    displayName: "John Doe",
    username: "johndoe",
    email: "john.doe@example.com"
  });

  const handleSave = () => {
    toast({
      title: "Profile Updated",
      description: "Your changes have been saved successfully."
    });
  };

  const handleLogout = () => {
    toast({
      title: "Logged Out",
      description: "You have been logged out successfully."
    });
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <div className="flex-1 container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <Avatar className="w-24 h-24 mx-auto mb-4">
              <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
                JD
              </AvatarFallback>
            </Avatar>
            <h1 className="text-3xl font-bold mb-2">{profile.displayName}</h1>
            <p className="text-muted-foreground">@{profile.username}</p>
          </div>

          {/* Profile Form */}
          <Card className="p-8 mb-6">
            <h2 className="text-2xl font-bold mb-6">Profile Information</h2>
            <div className="space-y-6">
              <div>
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  type="text"
                  value={profile.displayName}
                  onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={profile.username}
                  onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="mt-2"
                />
              </div>

              <Button onClick={handleSave} className="w-full gap-2">
                <Save className="h-4 w-4" />
                Save Changes
              </Button>
            </div>
          </Card>

          {/* Stats Card */}
          <Card className="p-6 mb-6">
            <h3 className="text-xl font-bold mb-4">Your Stats</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold text-primary">5</div>
                <div className="text-sm text-muted-foreground">Projects</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary">23</div>
                <div className="text-sm text-muted-foreground">Chapters</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary">147</div>
                <div className="text-sm text-muted-foreground">Pages</div>
              </div>
            </div>
          </Card>

          {/* Logout Button */}
          <Button 
            variant="destructive" 
            onClick={handleLogout}
            className="w-full gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Profile;
