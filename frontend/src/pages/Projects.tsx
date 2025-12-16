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
import { Plus, MoreVertical, FolderOpen, Trash2, Copy } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Dummy data
const dummyProjects = [
  {
    id: "1",
    name: "Dragon's Legacy",
    description: "An epic fantasy adventure",
    coverColor: "from-red-500 to-orange-500",
    updatedAt: "2024-01-15",
    chapters: 5
  },
  {
    id: "2",
    name: "Moonlit Romance",
    description: "A love story under the stars",
    coverColor: "from-purple-500 to-pink-500",
    updatedAt: "2024-01-12",
    chapters: 3
  },
  {
    id: "3",
    name: "Cyber Warriors",
    description: "Futuristic action thriller",
    coverColor: "from-cyan-500 to-blue-500",
    updatedAt: "2024-01-10",
    chapters: 8
  },
   {
    id: "1",
    name: "Dragon's Legacy",
    description: "An epic fantasy adventure",
    coverColor: "from-red-500 to-orange-500",
    updatedAt: "2024-01-15",
    chapters: 5
  },
  {
    id: "2",
    name: "Moonlit Romance",
    description: "A love story under the stars",
    coverColor: "from-purple-500 to-pink-500",
    updatedAt: "2024-01-12",
    chapters: 3
  },
  {
    id: "3",
    name: "Cyber Warriors",
    description: "Futuristic action thriller",
    coverColor: "from-cyan-500 to-blue-500",
    updatedAt: "2024-01-10",
    chapters: 8
  },
];

const Projects = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [projects, setProjects] = useState(dummyProjects);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [step, setStep] = useState(1);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    tags: ""
  });

  const handleCreateProject = () => {
    if (step === 1) {
      if (!newProject.name.trim()) {
        toast({
          title: "Error",
          description: "Please enter a project name",
          variant: "destructive"
        });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else {
      // Create project
      const project = {
        id: String(projects.length + 1),
        name: newProject.name,
        description: newProject.description,
        coverColor: "from-green-500 to-teal-500",
        updatedAt: new Date().toISOString().split('T')[0],
        chapters: 0
      };
      setProjects([...projects, project]);
      
      toast({
        title: "Project Created",
        description: "Your new project is ready!"
      });
      
      // Reset and navigate
      setShowNewProjectDialog(false);
      setStep(1);
      setNewProject({ name: "", description: "", tags: "" });
      navigate(`/projects/${project.id}`);
    }
  };

  const handleDeleteProject = (id: string, name: string) => {
    setProjects(projects.filter(p => p.id !== id));
    toast({
      title: "Project Deleted",
      description: `"${name}" has been removed`
    });
  };

  const handleDuplicateProject = (project: typeof dummyProjects[0]) => {
    const duplicated = {
      ...project,
      id: String(projects.length + 1),
      name: `${project.name} (Copy)`,
      updatedAt: new Date().toISOString().split('T')[0]
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
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">My Projects</h1>
          <p className="text-muted-foreground">Manage your manga and webtoon projects</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Create New Card */}
          <Card 
            className="aspect-[3/4] flex flex-col items-center justify-center cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-2 border-dashed group"
            onClick={() => setShowNewProjectDialog(true)}
          >
            <div className="text-center p-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                <Plus className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Create New Webtoon</h3>
              <p className="text-sm text-muted-foreground">Start your next masterpiece</p>
            </div>
          </Card>

          {/* Project Cards */}
          {projects.map((project) => (
            <Card 
              key={project.id}
              className="aspect-[3/4] relative overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-2 group"
            >
              <div 
                className={`absolute inset-0 bg-gradient-to-br ${project.coverColor} opacity-90 group-hover:opacity-100 transition-opacity`}
                onClick={() => navigate(`/projects/${project.id}`)}
              />
              
              <div className="absolute inset-0 p-6 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div className="flex-1" onClick={() => navigate(`/projects/${project.id}`)}>
                    <h3 className="text-white font-bold text-xl mb-2 line-clamp-2">
                      {project.name}
                    </h3>
                    <p className="text-white/80 text-sm line-clamp-2">
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
                        onClick={() => handleDeleteProject(project.id, project.name)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="text-white/80 text-sm">
                  <div>{project.chapters} chapters</div>
                  <div>Updated {project.updatedAt}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* New Project Dialog */}
      <Dialog open={showNewProjectDialog} onOpenChange={(open) => {
        setShowNewProjectDialog(open);
        if (!open) {
          setStep(1);
          setNewProject({ name: "", description: "", tags: "" });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {step === 1 && "Step 1: Project Name"}
              {step === 2 && "Step 2: Description"}
              {step === 3 && "Step 3: Ready to Create"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {step === 1 && (
              <div>
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="Enter a unique name"
                  className="mt-2"
                />
              </div>
            )}

            {step === 2 && (
              <>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    placeholder="Describe your project"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="tags">Tags/Genres (optional)</Label>
                  <Input
                    id="tags"
                    value={newProject.tags}
                    onChange={(e) => setNewProject({ ...newProject, tags: e.target.value })}
                    placeholder="e.g. fantasy, action, romance"
                    className="mt-2"
                  />
                </div>
              </>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium mb-1">Name:</div>
                  <div className="text-muted-foreground">{newProject.name}</div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Description:</div>
                  <div className="text-muted-foreground">{newProject.description || "None"}</div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Tags:</div>
                  <div className="text-muted-foreground">{newProject.tags || "None"}</div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            <Button onClick={handleCreateProject}>
              {step === 3 ? "Start Creating" : "Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default Projects;
