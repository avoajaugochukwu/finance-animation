"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useSessionStore } from '@/lib/store';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Card } from '@/components/ui/card';
import { FileSearch, Sparkles } from 'lucide-react';
import { SCENE_DURATION_SECONDS } from '@/lib/config/development';
import { countWords } from '@/lib/utils/word-count';
import { NarrativeContext } from '@/lib/types';

export function ScriptAnalyzer() {
  const {
    script,
    outline,
    setCharacters,
    setScenes,
    setAssetApproval,
    setGenerating,
    addError,
    clearErrors,
  } = useSessionStore();

  const hasAnalyzedRef = useRef(false);
  const [analysisPhase, setAnalysisPhase] = useState<'narrative' | 'scenes'>('narrative');

  const analyzeScript = async () => {
    if (!script) {
      addError('No script available for analysis');
      return;
    }

    hasAnalyzedRef.current = true;
    clearErrors();

    // Use polished script if available, otherwise fall back to draft
    const scriptContent = script.polished_content || script.content;

    setGenerating(true);
    setAssetApproval({ phase: 'analyzing' });

    try {
      // Stage 1: Get narrative context (story arc, scene briefs)
      setAnalysisPhase('narrative');
      const narrativeRes = await fetch('/api/analyze/narrative', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ script: scriptContent }),
      });

      if (!narrativeRes.ok) {
        throw new Error('Failed to analyze narrative');
      }

      const narrativeContext: NarrativeContext = await narrativeRes.json();
      console.log('[ScriptAnalyzer] Narrative context:', narrativeContext.story_arc);

      // Stage 2: Generate scenes with narrative context
      setAnalysisPhase('scenes');
      const scenesRes = await fetch('/api/analyze/script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          script: scriptContent,
          outline: outline,
          narrativeContext: narrativeContext,
        }),
      });

      if (!scenesRes.ok) {
        throw new Error('Failed to analyze script');
      }

      const { characters, scenes } = await scenesRes.json();

      setCharacters(characters);
      setScenes(scenes);

      // Move to character approval phase
      setAssetApproval({ phase: 'characters' });
      setGenerating(false);
    } catch (error) {
      console.error('Script analysis error:', error);
      addError('Failed to analyze script. Please try again.');
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!hasAnalyzedRef.current && script) {
      analyzeScript();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculate expected scenes based on actual script word count
  const scriptContent = script?.polished_content || script?.content || '';
  const wordCount = countWords(scriptContent);
  const estimatedDurationMinutes = Math.ceil(wordCount / 150);
  const expectedScenes = Math.round((estimatedDurationMinutes * 60) / SCENE_DURATION_SECONDS);

  return (
    <Card className="p-8">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="relative">
            {analysisPhase === 'narrative' ? (
              <Sparkles className="h-16 w-16 text-purple-500" />
            ) : (
              <FileSearch className="h-16 w-16 text-blue-500" />
            )}
            <div className="absolute -bottom-1 -right-1">
              <div className="animate-ping absolute h-3 w-3 bg-blue-400 rounded-full"></div>
              <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-semibold">
            {analysisPhase === 'narrative' ? 'Understanding Story Arc' : 'Creating Visual Scenes'}
          </h3>
          <p className="text-gray-600">
            {analysisPhase === 'narrative'
              ? `Analyzing narrative flow of your ${wordCount}-word script...`
              : `Breaking into ~${expectedScenes} minimalist scenes...`}
          </p>
        </div>

        <LoadingSpinner size="lg" />

        <div className="space-y-2 text-sm text-gray-500">
          <div className="flex items-center justify-center gap-2">
            <div className={`w-4 h-4 border-2 rounded-full ${analysisPhase === 'narrative' ? 'border-purple-500 animate-pulse' : 'border-green-500 bg-green-500'}`}></div>
            <span className={analysisPhase === 'scenes' ? 'text-green-600' : ''}>
              Stage 1: Analyzing story arc & emotional beats
            </span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className={`w-4 h-4 border-2 rounded-full ${analysisPhase === 'scenes' ? 'border-blue-500 animate-pulse' : 'border-gray-300'}`}></div>
            <span className={analysisPhase === 'narrative' ? 'text-gray-400' : ''}>
              Stage 2: Creating {expectedScenes} minimalist scenes ({SCENE_DURATION_SECONDS}s each)
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-4">
          Using radical minimalism: ONE focal element per scene
        </p>
      </div>
    </Card>
  );
}