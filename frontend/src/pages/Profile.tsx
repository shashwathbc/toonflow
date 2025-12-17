import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/nav/Navbar";
import Footer from "@/components/nav/Footer";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { User as UserIcon, LogOut, Save } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, logout } = useAuth();

  const [profile, setProfile] = useState({
    displayName: "",
    username: "",
    email: ""
  });

  useEffect(() => {
    if (user) {
      setProfile({
        displayName: user.displayName || "",
        // Firebase Auth doesn't store username by default, fallback to using email prefix or display name
        username: user.displayName?.replace(/\s+/g, '').toLowerCase() || user.email?.split('@')[0] || "",
        email: user.email || ""
      });
    }
  }, [user]);

  const handleSave = () => {
    // Note: To actually update the profile in Firebase, we would need updateProfile from firebase/auth
    // For now, this just shows a toast as requested by the task scope (UI update)
    toast({
      title: "Profile Updated",
      description: "This is a demo. Profile updates are not persisted to backend in this version.",
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged Out",
        description: "You have been logged out successfully."
      });
      navigate("/login");
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  const getInitials = () => {
    if (user?.displayName) {
      return user.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2);
    }
    return user?.email?.substring(0, 2).toUpperCase() || "U";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <div className="flex-1 container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <Avatar className="w-24 h-24 mx-auto mb-4">
              {user?.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || "User"} />}
              <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <h1 className="text-3xl font-bold mb-2">{profile.displayName || "User"}</h1>
            <p className="text-muted-foreground">{profile.email}</p>
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
                <Label htmlFor="username">Username (derived)</Label>
                <Input
                  id="username"
                  type="text"
                  value={profile.username}
                  disabled
                  className="mt-2 bg-muted/50"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  disabled
                  className="mt-2 bg-muted/50"
                />
              </div>

              <Button onClick={handleSave} className="w-full gap-2">
                <Save className="h-4 w-4" />
                Save Changes (Demo)
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
