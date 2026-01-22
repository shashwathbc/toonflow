import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "@/components/nav/Navbar";
import Footer from "@/components/nav/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, MoreVertical, Edit, Trash2, Copy, Lock } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { getDemoProject, isDemoProject } from "@/data/demoProjects";

const ProjectDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // Check if this is a demo project
  const isDemo = isDemoProject(id || "");
  const demoProject = isDemo ? getDemoProject(id || "") : null;

  // Load user projects from localStorage
  const loadUserProjects = () => {
    if (!user) return [];
    const userId = (user as any).username || (user as any).email || 'user';
    const stored = localStorage.getItem(`projects_${userId}`);
    return stored ? JSON.parse(stored) : [];
  };

  // Find user project
  const userProjects = loadUserProjects();
  const userProject = userProjects.find((p: any) => p.id === id);

  // Build project object
  const project = demoProject ? {
    name: demoProject.name,
    description: demoProject.description,
    chapters: demoProject.chapters.map((ch, idx) => ({
      id: ch.id,
      number: idx + 1,
      title: ch.title,
      pages: ch.pages
    }))
  } : userProject ? {
    name: userProject.name,
    description: userProject.description,
    chapters: [] // User projects start with no chapters
  } : null;

  // Show loader for 1.5 seconds then either show project or redirect
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      if (!project) {
        // Redirect to projects page instead of showing not found
        navigate("/projects");
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [project, navigate]);

  // Lightning loader
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="relative">
          {/* Animated lightning circle */}
          <svg className="w-32 h-32 animate-spin" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="lightning-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#a855f7', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#ec4899', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="url(#lightning-gradient)"
              strokeWidth="4"
              fill="none"
              strokeDasharray="60 200"
              strokeLinecap="round"
              style={{
                filter: 'drop-shadow(0 0 10px rgba(168, 85, 247, 0.8))',
                animation: 'dash 1.5s ease-in-out infinite'
              }}
            />
          </svg>

          {/* Thunder bolt icon in center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-12 h-12 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" style={{ filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.8))' }} />
            </svg>
          </div>
        </div>
        <p className="mt-6 text-lg text-muted-foreground animate-pulse">Loading project...</p>

        <style>{`
          @keyframes dash {
            0% {
              stroke-dasharray: 1 200;
              stroke-dashoffset: 0;
            }
            50% {
              stroke-dasharray: 89 200;
              stroke-dashoffset: -35px;
            }
            100% {
              stroke-dasharray: 89 200;
              stroke-dashoffset: -124px;
            }
          }
        `}</style>
      </div>
    );
  }

  if (!project) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <div className="flex-1 container mx-auto px-4 py-16">
        {/* Back Button */}
        <Button
          variant="ghost"
          className="mb-6 gap-2"
          onClick={() => navigate("/projects")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Button>

        {/* Project Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{project.name}</h1>
          <p className="text-muted-foreground">{project.description}</p>
          <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
            <span>{project.chapters.length} chapters</span>
            <span>•</span>
            <span>{project.chapters.length > 0 ? project.chapters.reduce((sum: number, ch: { pages: number }) => sum + ch.pages, 0) : 0} pages total</span>
          </div>
        </div>

        {/* New Chapter Button - Only for logged-in users on non-demo projects */}
        {!isDemo && user && (
          <Button className="mb-6 gap-2" onClick={() => {
            toast({
              title: "New Chapter",
              description: "Create new chapter dialog would open here"
            });
          }}>
            <Plus className="h-4 w-4" />
            New Chapter
          </Button>
        )}

        {/* Demo Project Note */}
        {isDemo && (
          <div className="mb-6 p-4 bg-muted/50 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">
              📚 <strong>Demo Project:</strong> Explore the 3 chapters below to learn how the editor works.
              {!user && <span> <a href="/login" className="text-primary hover:underline">Login</a> to create your own projects and chapters.</span>}
            </p>
          </div>
        )}

        {/* Chapters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {project.chapters.map((chapter: any) => (
            <Card
              key={chapter.id}
              className="p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer group relative"
              onClick={() => navigate(`/projects/${id}/editor?chapter=${chapter.number}`)}
            >
              <div className="absolute top-4 right-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/projects/${id}/editor?chapter=${chapter.number}`);
                    }}>
                      <Edit className="h-4 w-4 mr-2" />
                      Open
                    </DropdownMenuItem>
                    {!isDemo && (
                      <>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          toast({ title: "Chapter Duplicated" });
                        }}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            toast({ title: "Chapter Deleted", variant: "destructive" });
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="aspect-video bg-zinc-100 rounded-lg mb-4 overflow-hidden relative group-hover:shadow-md transition-all">
                {chapter.number === 1 ? (
                  <img
                    src="/intro/03.jpg"
                    alt="Chapter Cover"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                    <div className="text-6xl font-bold text-primary/30">
                      {chapter.number}
                    </div>
                  </div>
                )}
              </div>

              <h3 className="font-bold text-lg mb-1">Chapter {chapter.number}</h3>
              <p className="text-muted-foreground mb-2">{chapter.title}</p>
              <p className="text-sm text-muted-foreground">{chapter.pages} pages</p>
            </Card>
          ))}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ProjectDetail;
