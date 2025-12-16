import React from 'react';
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";

interface SectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, isOpen, onToggle, children }) => {
  return (
    <div className="rounded-2xl bg-muted/50 border p-3">
      <Button
        className="w-full flex items-center justify-between text-left"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <span className="font-semibold">{title}</span>
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>
      <div
        className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${
          isOpen ? "max-h-[1200px] opacity-100 mt-3" : "max-h-0 opacity-0"
        }`}
      >
        {isOpen && <div className="space-y-3">{children}</div>}
      </div>
    </div>
  );
};

export default Section;