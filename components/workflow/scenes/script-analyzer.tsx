"use client";

import React, { useEffect, useRef } from 'react';
import { useSessionStore } from '@/lib/store';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { Card } from '@/components/ui/card';
import { FileSearch } from 'lucide-react';
import { countWords } from '@/lib/utils/word-count';

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

  const analyzeScript = async () => {
    if (!script) {
      addError('No script available for analysis');
      return;
    }

    hasAnalyzedRef.current = true;
    clearErrors();

    const scriptContent = script.polished_content || script.content;

    setGenerating(true);
    setAssetApproval({ phase: 'analyzing' });

    try {
      // Single-stage: Generate scenes directly (Casual Finance style hardcoded in API)
      const scenesRes = await fetch('/api/analyze/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: scriptContent,
          outline: outline,
        }),
      });

      if (!scenesRes.ok) {
        throw new Error('Failed to analyze script');
      }

      const { characters, scenes } = await scenesRes.json();

      setCharacters(characters);
      setScenes(scenes);
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

  // Calculate expected scenes based on ~12 words per scene (linear translator mode)
  const WORDS_PER_SCENE = 12;
  const scriptContent = script?.polished_content || script?.content || '';
  const wordCount = countWords(scriptContent);
  const expectedScenes = Math.ceil(wordCount / WORDS_PER_SCENE);

  return (
    <Card className="p-8">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="relative">
            <FileSearch className="h-16 w-16 text-blue-500" />
            <div className="absolute -bottom-1 -right-1">
              <div className="animate-ping absolute h-3 w-3 bg-blue-400 rounded-full"></div>
              <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-semibold">Creating Casual Finance Scenes</h3>
          <p className="text-gray-600">
            Translating {wordCount} words into ~{expectedScenes} sequential scenes...
          </p>
        </div>

        <LoadingSpinner size="lg" />

        <p className="text-xs text-gray-400 mt-4">
          Linear translator mode: Scene 1 = first words, Scene 2 = next words, etc.
        </p>
      </div>
    </Card>
  );
}