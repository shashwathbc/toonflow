import { useNavigate, useParams } from "react-router-dom";
import Navbar from "@/components/nav/Navbar";
import Footer from "@/components/nav/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, MoreVertical, Edit, Trash2, Copy } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

// Dummy data
const projectData: Record<string, any> = {
  "1": {
    name: "Dragon's Legacy",
    description: "An epic fantasy adventure",
    chapters: [
      { id: "1", number: 1, title: "The Beginning", pages: 12 },
      { id: "2", number: 2, title: "First Encounter", pages: 15 },
      { id: "3", number: 3, title: "Training Arc", pages: 18 },
      { id: "4", number: 4, title: "The Tournament", pages: 20 },
      { id: "5", number: 5, title: "Awakening", pages: 14 },
    ]
  },
  "2": {
    name: "Moonlit Romance",
    description: "A love story under the stars",
    chapters: [
      { id: "1", number: 1, title: "First Meeting", pages: 10 },
      { id: "2", number: 2, title: "Growing Closer", pages: 12 },
      { id: "3", number: 3, title: "Confession", pages: 16 },
    ]
  },
  "3": {
    name: "Cyber Warriors",
    description: "Futuristic action thriller",
    chapters: [
      { id: "1", number: 1, title: "Pilot", pages: 8 },
      { id: "2", number: 2, title: "System Breach", pages: 14 },
      { id: "3", number: 3, title: "Counterattack", pages: 16 },
      { id: "4", number: 4, title: "Alliance", pages: 12 },
      { id: "5", number: 5, title: "Infiltration", pages: 18 },
      { id: "6", number: 6, title: "Betrayal", pages: 15 },
      { id: "7", number: 7, title: "Final Stand", pages: 20 },
      { id: "8", number: 8, title: "Epilogue", pages: 10 },
    ]
  }
};

const ProjectDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  
  const project = projectData[id || "1"] || projectData["1"];

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
            <span>{project.chapters.reduce((sum: number, ch: any) => sum + ch.pages, 0)} pages total</span>
          </div>
        </div>

        {/* New Chapter Button */}
        <Button className="mb-6 gap-2" onClick={() => {
          toast({
            title: "New Chapter",
            description: "Create new chapter dialog would open here"
          });
        }}>
          <Plus className="h-4 w-4" />
          New Chapter
        </Button>

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
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg mb-4 flex items-center justify-center">
                <div className="text-6xl font-bold text-primary/30">
                  {chapter.number}
                </div>
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
