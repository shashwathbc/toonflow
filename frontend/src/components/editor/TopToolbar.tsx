import React from 'react';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Eye, Download, Save, Pencil, RotateCcw, RotateCw } from "lucide-react";

interface TopToolbarProps {
  onBack: () => void;
  onSave: () => void;
  onExport: () => void;
  isEditMode: boolean;
  setIsEditMode: (v: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const TopToolbar: React.FC<TopToolbarProps> = ({
  onBack, onSave, onExport, isEditMode, setIsEditMode,
  onUndo, onRedo, canUndo, canRedo
}) => {
  return (
    <div className="border-b bg-card">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-2 border-l pl-4 ml-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-mode"
                checked={isEditMode}
                onCheckedChange={setIsEditMode}
              />
              <Label htmlFor="edit-mode" className="flex items-center gap-1 cursor-pointer">
                {isEditMode ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {isEditMode ? "Edit Mode" : "View Mode"}
              </Label>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditMode && (
            <div className="flex items-center gap-1 mr-2 border-r pr-2">
              <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>
          )}

          <Button variant="outline" size="sm" className="gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={onExport}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button size="sm" onClick={onSave} className="gap-2">
            <Save className="h-4 w-4" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TopToolbar;