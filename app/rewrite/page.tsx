"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RefreshCw, Copy, Check, Loader2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

type GenerationStatus = 'idle' | 'generating' | 'completed' | 'error';

interface RewriteMetadata {
  input_word_count: number;
  output_word_count: number;
  target_word_count: number;
  variance: number;
  variance_percentage: string;
}

export default function RewritePage() {
  // Form inputs
  const [inputText, setInputText] = useState('');
  const [targetWordCount, setTargetWordCount] = useState(500);

  // Generation state
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [rewrittenText, setRewrittenText] = useState('');
  const [metadata, setMetadata] = useState<RewriteMetadata | null>(null);

  // UI state
  const [copied, setCopied] = useState(false);

  const inputWordCount = inputText.trim().split(/\s+/).filter(w => w.length > 0).length;

  const handleRewrite = async () => {
    // Validation
    if (inputText.trim().length < 50) {
      toast.error('Please enter at least 50 characters');
      return;
    }

    if (targetWordCount < 50 || targetWordCount > 10000) {
      toast.error('Target word count must be between 50 and 10,000');
      return;
    }

    setStatus('generating');
    setRewrittenText('');
    setMetadata(null);

    try {
      const response = await fetch('/api/generate/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_text: inputText,
          target_word_count: targetWordCount,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to rewrite text');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Rewrite failed');
      }

      setRewrittenText(data.rewritten_text);
      setMetadata(data.metadata);
      setStatus('completed');
      toast.success(`Rewritten! ${data.metadata.output_word_count} words`);

    } catch (error) {
      console.error('Rewrite error:', error);
      setStatus('error');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Rewrite failed: ${errorMessage}`);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(rewrittenText);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setInputText('');
    setRewrittenText('');
    setMetadata(null);
    setStatus('idle');
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Relatable Rewriter</h1>
        <p className="text-muted-foreground">
          Transform any text into high-energy, TTS-ready relatable prose
        </p>
      </div>

      <div className="space-y-6">
        {/* Input Card */}
        <Card>
          <CardHeader>
            <CardTitle>Input Text</CardTitle>
            <CardDescription>
              Paste the text you want to transform into relatable narration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste your text here... (minimum 50 characters)"
              rows={12}
              disabled={status === 'generating'}
              className="font-mono text-sm"
            />
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>{inputText.length} characters</span>
              <span>{inputWordCount} words</span>
            </div>
          </CardContent>
        </Card>

        {/* Controls Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">
                  Target Word Count
                </label>
                <Input
                  type="number"
                  value={targetWordCount}
                  onChange={(e) => setTargetWordCount(Number(e.target.value))}
                  min={50}
                  max={10000}
                  disabled={status === 'generating'}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Approximate reading time: {Math.round(targetWordCount / 150)} min
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleClear}
                  disabled={status === 'generating'}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>

                <Button
                  onClick={handleRewrite}
                  disabled={status === 'generating' || inputText.trim().length < 50}
                  className="min-w-[140px]"
                >
                  {status === 'generating' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Rewriting...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Rewrite
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Output Card */}
        {(rewrittenText || status === 'generating') && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Rewritten Output</CardTitle>
                {metadata && (
                  <CardDescription>
                    {metadata.output_word_count} words (target: {metadata.target_word_count}, variance: {metadata.variance_percentage})
                  </CardDescription>
                )}
              </div>
              {rewrittenText && (
                <Button
                  onClick={handleCopy}
                  variant="outline"
                  size="sm"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {status === 'generating' ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-3 text-muted-foreground">Generating relatable prose...</span>
                </div>
              ) : (
                <Textarea
                  value={rewrittenText}
                  readOnly
                  rows={16}
                  className="font-sans text-sm bg-gray-50"
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {status === 'idle' && !rewrittenText && (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Paste your text above and click Rewrite to transform it</p>
              <p className="text-sm mt-2">Output will be pure prose with no markdown formatting</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
