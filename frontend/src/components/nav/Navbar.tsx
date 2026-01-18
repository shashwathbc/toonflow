import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { User, LogOut, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  // Get initials from display name or email
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

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <nav className="border-b border-border/50 bg-card/90 backdrop-blur-md sticky top-0 z-50 shadow-lg shadow-black/20">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="logo-container hover:opacity-90 transition-opacity">
            <span className="logo-toonflow animate-jelly">Toonflow</span>
            <span className="logo-studio animate-jelly">Studio</span>
            <span className="logo-paint animate-jelly">Paint</span>
          </Link>

          {/* Navigation Links - Desktop */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/"
              className={`transition-colors ${isActive('/') ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Home
            </Link>
            <Link
              to="/about"
              className={`transition-colors ${isActive('/about') ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              About
            </Link>
            <Link
              to="/projects"
              className={`transition-colors ${isActive('/projects') ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Projects
            </Link>
            <Link
              to="/contact"
              className={`transition-colors ${isActive('/contact') ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Contact
            </Link>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <div className="flex flex-col gap-4 mt-6">
                  <Link
                    to="/"
                    className={`transition-colors ${isActive('/') ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Home
                  </Link>
                  <Link
                    to="/about"
                    className={`transition-colors ${isActive('/about') ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    About
                  </Link>
                  <Link
                    to="/projects"
                    className={`transition-colors ${isActive('/projects') ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Projects
                  </Link>
                  <Link
                    to="/contact"
                    className={`transition-colors ${isActive('/contact') ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Contact
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            <ThemeToggle />

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Avatar className="h-8 w-8">
                      {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || "User"} />}
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground">
                        {getInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <User className="h-4 w-4 mr-2" />
                    View Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link to="/login">Sign In</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
