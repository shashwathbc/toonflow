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
import { useScrollDetection } from "@/hooks/useScrollDetection";

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isScrolled = useScrollDetection(50);

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
    <nav
      className={`
        fixed top-0 left-0 right-0 z-50
        transition-all duration-500 ease-in-out
        ${isScrolled
          ? 'bg-black/15 backdrop-blur-lg border-b border-white/10'
          : 'bg-transparent backdrop-blur-md border-b border-white/5'
        }
      `}
      style={{
        backdropFilter: isScrolled ? 'blur(16px)' : 'blur(10px)',
      }}
    >
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
              className={`
                transition-all duration-300 ease-in-out
                text-white/90 hover:text-white
                ${isActive('/')
                  ? 'px-4 py-2 rounded-lg border-2 border-white/60 bg-white/10 backdrop-blur-sm shadow-[0_0_20px_rgba(255,255,255,0.4)] font-medium text-white'
                  : 'hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]'
                }
                relative
                ${!isActive('/') ? 'after:absolute after:bottom-[-4px] after:left-0 after:right-0 after:h-[2px] after:bg-white/0 after:transition-all after:duration-300 hover:after:bg-white/40' : ''}
              `}
            >
              Home
            </Link>
            <Link
              to="/about"
              className={`
                transition-all duration-300 ease-in-out
                text-white/90 hover:text-white
                ${isActive('/about')
                  ? 'px-4 py-2 rounded-lg border-2 border-white/60 bg-white/10 backdrop-blur-sm shadow-[0_0_20px_rgba(255,255,255,0.4)] font-medium text-white'
                  : 'hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]'
                }
                relative
                ${!isActive('/about') ? 'after:absolute after:bottom-[-4px] after:left-0 after:right-0 after:h-[2px] after:bg-white/0 after:transition-all after:duration-300 hover:after:bg-white/40' : ''}
              `}
            >
              About
            </Link>
            <Link
              to="/projects"
              className={`
                transition-all duration-300 ease-in-out
                text-white/90 hover:text-white
                ${isActive('/projects')
                  ? 'px-4 py-2 rounded-lg border-2 border-white/60 bg-white/10 backdrop-blur-sm shadow-[0_0_20px_rgba(255,255,255,0.4)] font-medium text-white'
                  : 'hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]'
                }
                relative
                ${!isActive('/projects') ? 'after:absolute after:bottom-[-4px] after:left-0 after:right-0 after:h-[2px] after:bg-white/0 after:transition-all after:duration-300 hover:after:bg-white/40' : ''}
              `}
            >
              Projects
            </Link>
            <Link
              to="/contact"
              className={`
                transition-all duration-300 ease-in-out
                text-white/90 hover:text-white
                ${isActive('/contact')
                  ? 'px-4 py-2 rounded-lg border-2 border-white/60 bg-white/10 backdrop-blur-sm shadow-[0_0_20px_rgba(255,255,255,0.4)] font-medium text-white'
                  : 'hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]'
                }
                relative
                ${!isActive('/contact') ? 'after:absolute after:bottom-[-4px] after:left-0 after:right-0 after:h-[2px] after:bg-white/0 after:transition-all after:duration-300 hover:after:bg-white/40' : ''}
              `}
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
                    className={`
                      transition-all duration-300 ease-in-out
                      text-white/90 hover:text-white
                      ${isActive('/') ? 'font-medium text-white' : ''}
                      hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]
                    `}
                  >
                    Home
                  </Link>
                  <Link
                    to="/about"
                    className={`
                      transition-all duration-300 ease-in-out
                      text-white/90 hover:text-white
                      ${isActive('/about') ? 'font-medium text-white' : ''}
                      hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]
                    `}
                  >
                    About
                  </Link>
                  <Link
                    to="/projects"
                    className={`
                      transition-all duration-300 ease-in-out
                      text-white/90 hover:text-white
                      ${isActive('/projects') ? 'font-medium text-white' : ''}
                      hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]
                    `}
                  >
                    Projects
                  </Link>
                  <Link
                    to="/contact"
                    className={`
                      transition-all duration-300 ease-in-out
                      text-white/90 hover:text-white
                      ${isActive('/contact') ? 'font-medium text-white' : ''}
                      hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]
                    `}
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
