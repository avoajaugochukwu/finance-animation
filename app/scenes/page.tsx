"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/lib/store';
import { SceneBreakdown } from '@/components/workflow/scene-breakdown';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRight, FileText, Sparkles } from 'lucide-react';
import { countWords } from '@/lib/utils/word-count';

export default function ScenesPage() {
  const router = useRouter();
  const { script, setScript, storyboardScenes } = useSessionStore();
  const [localScript, setLocalScript] = useState('');
  const [isScriptSet, setIsScriptSet] = useState(!!script?.content);

  // Check if all scenes are generated
  const allScenesGenerated = storyboardScenes.length > 0 &&
    storyboardScenes.every(scene => scene.generation_status === 'completed');

  const handleSetScript = () => {
    if (localScript.trim()) {
      const wordCount = countWords(localScript);
      setScript({
        content: localScript,
        word_count: wordCount,
        target_duration: Math.round(wordCount / 150), // ~150 words per minute
        generated_at: new Date(),
      });
      setIsScriptSet(true);
    }
  };

  const handleClearScript = () => {
    setLocalScript('');
    setIsScriptSet(false);
  };

  const wordCount = countWords(localScript);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Page Header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Scene Generator
            </h1>
            <p className="text-sm text-gray-600">
              Generate visual scenes from your script
            </p>
          </div>

          {/* Script Input Section - Show only if script not set */}
          {!isScriptSet && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Your Script
                </CardTitle>
                <CardDescription>
                  Paste or type your script below to generate visual scenes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={localScript}
                  onChange={(e) => setLocalScript(e.target.value)}
                  placeholder="Paste your script here..."
                  className="min-h-[300px] font-mono text-sm"
                />
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    {wordCount} words • ~{Math.round(wordCount / 150)} min read
                  </div>
                  <Button
                    onClick={handleSetScript}
                    disabled={!localScript.trim()}
                    className="gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate Scenes
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scene Breakdown Component - Show only if script is set */}
          {isScriptSet && (
            <>
              <Card className="p-6">
                <SceneBreakdown />
              </Card>

              {/* Edit Script Button */}
              <div className="text-center">
                <Button
                  variant="outline"
                  onClick={handleClearScript}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Change Script
                </Button>
              </div>
            </>
          )}

          {/* Continue to Export Button */}
          {allScenesGenerated && (
            <Card className="p-6 bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Scenes Complete!
                  </h3>
                  <p className="text-sm text-gray-600">
                    All scenes have been generated. Continue to export your work.
                  </p>
                </div>
                <Button
                  onClick={() => router.push('/export')}
                  className="gap-2"
                  size="lg"
                >
                  Continue to Export
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* Footer */}
          <footer className="text-center text-sm text-gray-500 py-4">
            <p>
              Session-only application • No data is saved • Export your work before leaving
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
