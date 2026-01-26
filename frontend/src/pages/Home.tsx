import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, Sparkles, TrendingUp, Users } from "lucide-react";
import Navbar from "@/components/nav/Navbar";
import Footer from "@/components/nav/Footer";
import LivingCanvas from "@/components/home/LivingCanvas";
import BubbleBackground from "@/components/ui/BubbleBackground";
import VideoBackground from "@/components/ui/VideoBackground";

const Home = () => {
  const navigate = useNavigate();

  const showcaseWorks = [
    {
      title: "Ramayana: The Immortal War",
      creator: "Shashwath",
      color: "from-amber-500 to-orange-600",
      url: "https://www.webtoons.com/en/canvas/ramayana-the-immortal-war/list?title_no=1099260",
      genre: "Epic Fantasy",
      image: "/assets/showcase/ramayana.png"
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />


      {/* Video Hero Section - Cinematic Background */}
      <section className="relative bg-black overflow-hidden h-[60vh] md:h-[70vh] lg:h-[80vh]">
        {/* Video Background - Responsive & Centered */}
        <div className="absolute inset-0 z-0">
          <VideoBackground
            videos={["/vid2.mp4", "/vid3.mp4"]}
            className="w-full h-full object-cover"
          />
          {/* Dark cosmic overlay - soft gradients */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-background" />
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-950/20 via-transparent to-indigo-950/20" />
        </div>
      </section>

      {/* Create Manga Faster Section */}
      <section className="relative py-20 bg-background overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
        <BubbleBackground />

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

      {/* Living Canvas Section */}
      <LivingCanvas />

      {/* Showcase Section */}
      <section className="py-20 bg-muted/30 overflow-hidden">
        <div className="container mx-auto px-4 mb-8">
          <h2 className="text-3xl font-bold text-center mb-4">Community Showcase</h2>
          <p className="text-center text-muted-foreground">See what creators are building</p>
        </div>

        <div className="relative">
          <div className="flex gap-4 animate-scroll justify-center">
            {showcaseWorks.map((work, index) => (
              <a
                key={index}
                href={work.url}
                target={work.url !== "#" ? "_blank" : undefined}
                rel={work.url !== "#" ? "noopener noreferrer" : undefined}
                className="block"
              >
                <Card
                  className="flex-shrink-0 w-64 h-80 overflow-hidden group cursor-pointer hover:ring-2 hover:ring-primary transition-all duration-300"
                >
                  <div className={`w-full h-full relative flex flex-col justify-end p-6 transition-transform duration-300 group-hover:scale-105`}>
                    {/* Background: Image or Gradient */}
                    {work.image ? (
                      <div className="absolute inset-0">
                        <img
                          src={work.image}
                          alt={work.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      </div>
                    ) : (
                      <div className={`absolute inset-0 bg-gradient-to-br ${work.color}`} />
                    )}

                    {/* Content Z-indexed above background */}
                    <div className="relative z-10">
                      {/* Genre Tag */}
                      <span className="inline-block px-2 py-1 mb-2 bg-black/40 backdrop-blur-sm rounded-full text-xs text-white font-medium">
                        {work.genre}
                      </span>

                      {/* External Link Indicator */}
                      {work.url !== "#" && (
                        <div className="absolute top-[-260px] right-[-10px] px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs text-white font-medium">
                          🔗 Webtoon
                        </div>
                      )}

                      {/* Title & Creator */}
                      <div>
                        <h4 className="text-white font-bold text-xl mb-1">{work.title}</h4>
                        <p className="text-white/80 text-sm">by {work.creator}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </a>
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
