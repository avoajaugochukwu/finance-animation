"use client";

import React from 'react';
import { useSessionStore } from '@/lib/store';
import { ScriptAnalyzer } from './scenes/script-analyzer';
import { CharacterApproval } from './scenes/character-approval';
import { StoryboardGenerator } from './scenes/storyboard-generator';
import { StoryboardGrid } from './scenes/storyboard-grid';

export function SceneBreakdown() {
  const { 
    script,
    assetApproval,
  } = useSessionStore();

  // If no script, show placeholder
  if (!script) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">
          Please generate a script first before creating scenes.
        </p>
      </div>
    );
  }

  // Render the appropriate phase based on approval state
  const renderPhase = () => {
    switch (assetApproval.phase) {
      case 'analyzing':
        return <ScriptAnalyzer />;
      case 'characters':
        return <CharacterApproval />;
      case 'generating':
        return <StoryboardGenerator />;
      case 'reviewing':
        return <StoryboardGrid />;
      default:
        return <ScriptAnalyzer />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Scene Generation</h2>
        <p className="text-gray-600">
          Creating visual storyboard with consistent characters
        </p>
      </div>

      {renderPhase()}
    </div>
  );
}