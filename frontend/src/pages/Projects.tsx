import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/nav/Navbar";
import Footer from "@/components/nav/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, MoreVertical, FolderOpen, Trash2, Copy, Lock } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { demoProjects, isDemoProject } from "@/data/demoProjects";

const Projects = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // Convert demo projects to match the existing format
  const formattedDemoProjects = demoProjects.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    coverColor: "from-orange-500 to-red-500",  // Fallback gradient
    thumbnail: p.thumbnail,  // Add thumbnail for image display
    updatedAt: new Date(p.createdAt).toISOString().split('T')[0],
    chapters: p.chapters.length,
    isDemoProject: true
  }));

  // Load user projects from localStorage
  const loadUserProjects = () => {
    if (!user) return [];
    const userId = (user as any).username || (user as any).email || 'user';
    const stored = localStorage.getItem(`projects_${userId}`);
    return stored ? JSON.parse(stored) : [];
  };

  // Merge demo and user projects
  const [projects, setProjects] = useState([...formattedDemoProjects, ...loadUserProjects()]);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
  });

  // Save projects to localStorage
  const saveUserProjects = (userProjects: any[]) => {
    if (user) {
      const userId = (user as any).username || (user as any).email || 'user';
      localStorage.setItem(`projects_${userId}`, JSON.stringify(userProjects));
    }
  };

  const handleCreateClick = () => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to create new projects",
        variant: "destructive"
      });
      return;
    }
    setShowNewProjectDialog(true);
  };

  const handleCreateProject = () => {
    if (!newProject.name.trim()) {
      toast({
        title: "Error",
        description: "Please enter a project name",
        variant: "destructive"
      });
      return;
    }

    // Create new project
    const project = {
      id: `user-${Date.now()}`,
      name: newProject.name,
      description: newProject.description,
      coverColor: "from-green-500 to-teal-500",
      updatedAt: new Date().toISOString().split('T')[0],
      chapters: 0,
      isDemoProject: false
    };

    const userProjects = loadUserProjects();
    const updatedUserProjects = [...userProjects, project];
    saveUserProjects(updatedUserProjects);

    setProjects([...formattedDemoProjects, ...updatedUserProjects]);

    toast({
      title: "Project Created",
      description: `"${newProject.name}" is ready!`
    });

    // Reset and close
    setShowNewProjectDialog(false);
    setNewProject({ name: "", description: "" });
    navigate(`/projects/${project.id}`);
  };

  const handleDeleteProject = (id: string, name: string, isDemo: boolean) => {
    if (isDemo) {
      toast({
        title: "Cannot Delete Demo",
        description: "Demo projects cannot be deleted",
        variant: "destructive"
      });
      return;
    }

    setProjects(projects.filter(p => p.id !== id));
    toast({
      title: "Project Deleted",
      description: `"${name}" has been removed`
    });
  };

  const handleDuplicateProject = (project: typeof projects[0]) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to duplicate projects",
        variant: "destructive"
      });
      navigate("/login");
      return;
    }

    const duplicated = {
      ...project,
      id: String(projects.length + 1),
      name: `${project.name} (Copy)`,
      updatedAt: new Date().toISOString().split('T')[0],
      isDemoProject: false
    };
    setProjects([...projects, duplicated]);
    toast({
      title: "Project Duplicated",
      description: `Created a copy of "${project.name}"`
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <div className="flex-1 container mx-auto px-4 py-16">
        <div className="mb-8 mt-8">
          <h1 className="text-4xl font-bold mb-2">My Projects</h1>
          <p className="text-muted-foreground">Manage your manga and webtoon projects</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Create New Card - Shows login hint if not logged in */}
          <Card
            className="aspect-[3/4] flex flex-col items-center justify-center cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-2 border-dashed group"
            onClick={handleCreateClick}
          >
            <div className="text-center p-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                {user ? (
                  <Plus className="h-8 w-8 text-primary" />
                ) : (
                  <Lock className="h-8 w-8 text-primary" />
                )}
              </div>
              <h3 className="font-semibold text-lg mb-2">Create New Webtoon</h3>
              <p className="text-sm text-muted-foreground">
                {user ? "Start your next masterpiece" : "Login to create projects"}
              </p>
            </div>
          </Card>

          {/* Project Cards */}
          {projects.map((project) => (
            <Card
              key={project.id}
              className="aspect-[3/4] relative overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-2 group"
            >
              {/* Background - Show image if available, otherwise gradient */}
              {project.thumbnail ? (
                <>
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${project.thumbnail})` }}
                    onClick={() => navigate(`/projects/${project.id}`)}
                  />
                  {/* Dark overlay for text visibility */}
                  <div
                    className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-all"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  />
                </>
              ) : (
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${project.coverColor} opacity-90 group-hover:opacity-100 transition-opacity`}
                  onClick={() => navigate(`/projects/${project.id}`)}
                />
              )}

              <div className="absolute inset-0 p-6 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div className="flex-1" onClick={() => navigate(`/projects/${project.id}`)}>
                    <h3 className="text-white font-bold text-xl mb-2 line-clamp-2" style={{ textShadow: '0 0 20px rgba(168, 85, 247, 0.8), 0 0 40px rgba(168, 85, 247, 0.5), 0 2px 4px rgba(0,0,0,0.8)' }}>
                      {project.name}
                    </h3>
                    <p className="text-white text-sm line-clamp-2" style={{ textShadow: '0 0 15px rgba(168, 85, 247, 0.7), 0 0 30px rgba(168, 85, 247, 0.4), 0 2px 4px rgba(0,0,0,0.8)' }}>
                      {project.description}
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-white hover:bg-white/20 h-8 w-8"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}`)}>
                        <FolderOpen className="h-4 w-4 mr-2" />
                        Open
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicateProject(project)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteProject(project.id, project.name, project.isDemoProject || false)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="text-white text-sm" style={{ textShadow: '0 0 15px rgba(168, 85, 247, 0.7), 0 0 30px rgba(168, 85, 247, 0.4), 0 2px 4px rgba(0,0,0,0.8)' }}>
                  <div>{project.chapters} chapters</div>
                  <div>Updated {project.updatedAt}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* New Project Dialog - Simplified Single Form */}
      <Dialog open={showNewProjectDialog} onOpenChange={(open) => {
        setShowNewProjectDialog(open);
        if (!open) {
          setNewProject({ name: "", description: "" });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Webtoon</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                placeholder="Enter your webtoon name"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                placeholder="Describe your webtoon story"
                className="mt-2"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewProjectDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject}>
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default Projects;
