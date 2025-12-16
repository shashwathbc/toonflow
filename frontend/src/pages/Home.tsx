import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, Sparkles, TrendingUp, Users } from "lucide-react";
import Navbar from "@/components/nav/Navbar";
import Footer from "@/components/nav/Footer";

const Home = () => {
  const navigate = useNavigate();

  const successStories = [
    { name: "Alex Chen", avatar: "AC", title: "Fantasy Webtoon", earnings: "$2.5K/month" },
    { name: "Maria Silva", avatar: "MS", title: "Romance Series", earnings: "$3.8K/month" },
    { name: "John Park", avatar: "JP", title: "Action Manga", earnings: "$5.2K/month" },
  ];

  const showcaseWorks = [
    { title: "Dragon's Quest", color: "from-red-500 to-orange-500" },
    { title: "Moonlight Tales", color: "from-blue-500 to-purple-500" },
    { title: "City Warriors", color: "from-green-500 to-teal-500" },
    { title: "Love & Coffee", color: "from-pink-500 to-rose-500" },
    { title: "Cyber Legends", color: "from-cyan-500 to-blue-500" },
    { title: "Forest Spirits", color: "from-emerald-500 to-green-500" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-in fade-in slide-in-from-bottom-4 duration-1000">
              Create Manga Faster
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 animate-in fade-in slide-in-from-bottom-5 duration-1000 delay-200">
              Professional manga creation tools with AI assistance. From concept to publication in minutes.
            </p>
            <div className="flex flex-wrap gap-4 justify-center animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-300">
              <Button size="lg" className="gap-2 h-12 text-lg" onClick={() => navigate("/projects")}>
                <Sparkles className="h-5 w-5" />
                Start a Project
              </Button>
              <Button size="lg" variant="outline" className="gap-2 h-12 text-lg">
                <Play className="h-5 w-5" />
                Watch Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Video Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="aspect-video bg-card rounded-2xl border-2 shadow-2xl overflow-hidden flex items-center justify-center">
              <div className="text-center p-8">
                <Play className="h-20 w-20 mx-auto mb-4 text-primary" />
                <p className="text-xl text-muted-foreground">Demo Video Coming Soon</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Info Split Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <Card className="p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <Users className="h-12 w-12 mb-4 text-primary" />
              <h3 className="text-2xl font-bold mb-4">How Manga is Made</h3>
              <p className="text-muted-foreground leading-relaxed">
                Traditional manga creation involves sketching, inking, adding screentones, and lettering. 
                Our tool streamlines this process with AI-powered assistance, pre-built templates, and 
                intuitive drawing tools that work for both beginners and professionals.
              </p>
            </Card>

            <div className="space-y-4">
              <h3 className="text-2xl font-bold mb-6">Success Stories</h3>
              {successStories.map((story, index) => (
                <Card 
                  key={index} 
                  className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold">
                      {story.avatar}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">{story.name}</h4>
                      <p className="text-sm text-muted-foreground">{story.title}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <TrendingUp className="h-4 w-4" />
                        <span className="font-bold">{story.earnings}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Showcase Section */}
      <section className="py-20 bg-muted/30 overflow-hidden">
        <div className="container mx-auto px-4 mb-8">
          <h2 className="text-3xl font-bold text-center mb-4">Community Showcase</h2>
          <p className="text-center text-muted-foreground">See what creators are building</p>
        </div>
        
        <div className="relative">
          <div className="flex gap-4 animate-scroll">
            {[...showcaseWorks, ...showcaseWorks].map((work, index) => (
              <Card 
                key={index} 
                className="flex-shrink-0 w-64 h-80 overflow-hidden group cursor-pointer"
              >
                <div className={`w-full h-full bg-gradient-to-br ${work.color} flex items-end p-6 transition-transform duration-300 group-hover:scale-105`}>
                  <h4 className="text-white font-bold text-xl">{work.title}</h4>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <Footer />

      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll {
          animation: scroll 30s linear infinite;
        }
        .animate-scroll:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-scroll {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
};

export default Home;
