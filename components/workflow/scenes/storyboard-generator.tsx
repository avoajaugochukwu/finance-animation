"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useSessionStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { StoryboardScene } from '@/lib/types';
import {
  Film,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export function StoryboardGenerator() {
  const {
    scenes,
    characters,
    storyboardScenes,
    setStoryboardScenes,
    updateStoryboardScene,
    setAssetApproval,
    setSceneGenerationProgress,
    sceneGenerationProgress,
  } = useSessionStore();

  const [generatingScenes, setGeneratingScenes] = useState(false);
  const [currentGeneratingScene, setCurrentGeneratingScene] = useState(0);
  const hasGeneratedScenesRef = useRef(false);

  const generateSceneImage = async (scene: StoryboardScene) => {
    try {
      updateStoryboardScene(scene.scene_number, { 
        generation_status: 'generating' 
      });

      const response = await fetch('/api/generate/scene-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scene,
          characters
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate scene image');
      }

      const data = await response.json();
      console.log(`Scene ${scene.scene_number} generated:`, data);
      
      updateStoryboardScene(scene.scene_number, {
        image_url: data.image_url,
        visual_prompt: data.prompt_used,
        generation_status: 'completed',
      });

      return true;
    } catch (error) {
      console.error(`Scene ${scene.scene_number} generation error:`, error);
      updateStoryboardScene(scene.scene_number, {
        generation_status: 'error',
        error_message: 'Failed to generate image',
      });
      return false;
    }
  };

  const generateAllScenes = async () => {
    hasGeneratedScenesRef.current = true;
    setGeneratingScenes(true);

    // Initialize storyboard scenes from regular scenes
    const initialStoryboardScenes: StoryboardScene[] = scenes.map(scene => ({
      ...scene,
      generation_status: 'pending',
      image_url: undefined, // Ensure image_url is undefined initially
    }));
    setStoryboardScenes(initialStoryboardScenes);

    // Generate all images in parallel for maximum speed
    const generationPromises = scenes.map((scene) =>
      generateSceneImage({
        ...scene,
        generation_status: 'pending'
      } as StoryboardScene)
    );

    // Wait for all generations to complete
    await Promise.all(generationPromises);

    setGeneratingScenes(false);
    setAssetApproval({ phase: 'reviewing' });
  };

  useEffect(() => {
    if (!hasGeneratedScenesRef.current && scenes.length > 0 && storyboardScenes.length === 0) {
      generateAllScenes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const completedScenes = storyboardScenes.filter(s => s.generation_status === 'completed').length;
  const errorScenes = storyboardScenes.filter(s => s.generation_status === 'error').length;

  // Update progress tracking based on actual completed scenes
  useEffect(() => {
    if (storyboardScenes.length > 0) {
      setCurrentGeneratingScene(completedScenes);
      const progress = (completedScenes / storyboardScenes.length) * 100;
      setSceneGenerationProgress(progress);
    }
  }, [completedScenes, storyboardScenes.length, setCurrentGeneratingScene, setSceneGenerationProgress]);

  return (
    <Card className="p-8">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="relative">
            <Film className="h-16 w-16 text-blue-500" />
            {generatingScenes && (
              <div className="absolute -bottom-1 -right-1">
                <div className="animate-ping absolute h-3 w-3 bg-blue-400 rounded-full"></div>
                <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
              </div>
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">Generating Storyboard</h3>
          <p className="text-gray-600">
            Creating visual scenes with consistent characters
          </p>
        </div>

        {/* Progress Information */}
        <div className="space-y-4 max-w-md mx-auto">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Progress</span>
              <span className="font-medium">
                {currentGeneratingScene} / {scenes.length} scenes
              </span>
            </div>
            <Progress value={sceneGenerationProgress} className="h-2" />
          </div>

          {/* Status Badges */}
          <div className="flex items-center justify-center gap-2">
            {completedScenes > 0 && (
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {completedScenes} Completed
              </Badge>
            )}
            {errorScenes > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errorScenes} Failed
              </Badge>
            )}
            {generatingScenes && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                Generating
              </Badge>
            )}
          </div>
        </div>

        {/* Scene Grid Preview */}
        <div className="grid grid-cols-4 gap-2 mt-6">
          {storyboardScenes.map((scene) => (
            <div
              key={scene.scene_number}
              className={`
                aspect-video rounded border-2 flex items-center justify-center
                ${scene.generation_status === 'completed' ? 'border-green-500 bg-green-50' : ''}
                ${scene.generation_status === 'generating' ? 'border-blue-500 bg-blue-50' : ''}
                ${scene.generation_status === 'error' ? 'border-red-500 bg-red-50' : ''}
                ${scene.generation_status === 'pending' ? 'border-gray-300 bg-gray-50' : ''}
              `}
            >
              {scene.generation_status === 'completed' ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : scene.generation_status === 'generating' ? (
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              ) : scene.generation_status === 'error' ? (
                <AlertCircle className="h-4 w-4 text-red-500" />
              ) : (
                <div className="text-xs text-gray-400">{scene.scene_number}</div>
              )}
            </div>
          ))}
        </div>

        {!generatingScenes && (
          <div className="text-sm text-gray-500">
            <p>Images are being generated with consistent visual styles.</p>
            <p>This ensures your characters look the same across all scenes.</p>
          </div>
        )}
      </div>
    </Card>
  );
}