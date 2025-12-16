import Navbar from "@/components/nav/Navbar";
import Footer from "@/components/nav/Footer";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Layers, Sparkles, Zap, Palette } from "lucide-react";

const About = () => {
  const features = [
    {
      icon: Layers,
      title: "Professional Tools",
      description: "Industry-standard drawing tools, layers system, and advanced panel management."
    },
    {
      icon: Sparkles,
      title: "AI Assistance",
      description: "Generate backgrounds, poses, and effects with our intelligent AI helper."
    },
    {
      icon: Zap,
      title: "Fast Workflow",
      description: "Templates, presets, and automation to speed up your creation process."
    },
    {
      icon: Palette,
      title: "Style Library",
      description: "Extensive collection of screentones, effects, and manga-specific assets."
    }
  ];

  const faqs = [
    {
      question: "Do I need drawing experience?",
      answer: "No! Our tool is designed for both beginners and professionals. We provide templates, AI assistance, and intuitive tools that make manga creation accessible to everyone."
    },
    {
      question: "Can I export my work?",
      answer: "Yes, you can export your chapters as high-quality PNG/JPG images or as a complete ZIP file. PDF export is coming soon."
    },
    {
      question: "What file formats are supported?",
      answer: "We support standard image formats for import (PNG, JPG, WebP) and export (PNG, JPG). Our native format preserves all layers and editing capabilities."
    },
    {
      question: "Is there a mobile app?",
      answer: "Currently we're web-based, but our responsive design works on tablets. A dedicated mobile app is in development."
    },
    {
      question: "How does the AI assistance work?",
      answer: "Our AI can generate manga panels, character poses, backgrounds, and effects based on your text prompts. You maintain full creative control and can edit any AI-generated content."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-16 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">About Manga Tool</h1>
          <p className="text-xl text-muted-foreground">
            Professional manga creation made simple and accessible
          </p>
        </div>

        {/* Overview */}
        <Card className="p-8 mb-12">
          <h2 className="text-2xl font-bold mb-4">Overview</h2>
          <div className="prose prose-lg max-w-none text-muted-foreground space-y-4">
            <p>
              Manga Tool is a comprehensive web-based platform designed to streamline the entire manga 
              creation process. From initial concept to final publication, our suite of professional 
              tools empowers creators to bring their stories to life efficiently.
            </p>
            <p>
              Built with modern web technologies, our platform combines traditional manga creation 
              techniques with cutting-edge AI assistance, providing a perfect balance between artistic 
              control and workflow efficiency.
            </p>
          </div>
        </Card>

        {/* Features Grid */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Key Features</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <feature.icon className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Workflow Section */}
        <Card className="p-8 mb-12">
          <h2 className="text-2xl font-bold mb-6">The Workflow</h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">1. Project Setup</h3>
              <p className="text-muted-foreground">
                Create a new manga project with a name and description. Organize your work into 
                chapters for better structure.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">2. Character Creation</h3>
              <p className="text-muted-foreground">
                Build your character library with reference images, color palettes, and personality 
                traits for consistency across your manga.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">3. Page Design</h3>
              <p className="text-muted-foreground">
                Use our canvas editor with professional tools: panel layouts, drawing brushes, 
                speech bubbles, effects, and screentones.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">4. AI Enhancement</h3>
              <p className="text-muted-foreground">
                Leverage AI to generate backgrounds, character poses, speed lines, and other manga 
                elements to accelerate your workflow.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">5. Export & Share</h3>
              <p className="text-muted-foreground">
                Export your finished chapters in high quality formats, ready for publication on 
                webtoon platforms or print.
              </p>
            </div>
          </div>
        </Card>

        {/* Tips Section */}
        <Card className="p-8 mb-12">
          <h2 className="text-2xl font-bold mb-6">Pro Tips</h2>
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              <span>Use keyboard shortcuts to speed up your workflow - press ? in the editor for a full list</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              <span>Save frequently and use layers to maintain non-destructive editing</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              <span>Start with templates to learn panel layouts and pacing</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              <span>Experiment with different AI prompts to get varied results</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              <span>Preview your chapters in reading mode to check pacing and flow</span>
            </li>
          </ul>
        </Card>

        {/* FAQ */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default About;
