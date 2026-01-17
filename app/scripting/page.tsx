"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Copy, Check, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

type GenerationStatus = 'idle' | 'generating' | 'completed' | 'error';
type StepStatus = 'pending' | 'in_progress' | 'completed' | 'error';

interface Step {
  number: number;
  label: string;
  status: StepStatus;
}

interface Finding {
  title: string;
  description: string;
}

interface FindingGroup {
  principle_name: string;
  findings: Finding[];
}

interface AugmentedResearch {
  findings_by_principle: FindingGroup[];
}

interface Module {
  principle_name: string;
  level_1_principle: string;
  level_2_strategy: string;
  level_3_actionable_steps: string[];
  level_4_reflection_question: string;
}

interface Outline {
  modules: Module[];
}

export default function NewScriptingPage() {
  // Form inputs
  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');
  const [book, setBook] = useState('');
  const [targetWordCount, setTargetWordCount] = useState(2000);

  // Generation state
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [steps, setSteps] = useState<Step[]>([
    { number: 1, label: 'Formulating Core Question', status: 'pending' },
    { number: 2, label: 'Extracting Core Principles', status: 'pending' },
    { number: 3, label: 'Conducting Augmented Research', status: 'pending' },
    { number: 4, label: 'Synthesizing Script Outline', status: 'pending' },
    { number: 5, label: 'Generating Final Script', status: 'pending' },
  ]);

  // Generated data
  const [coreQuestion, setCoreQuestion] = useState('');
  const [corePrinciples, setCorePrinciples] = useState<Array<{name: string, description: string}>>([]);
  const [finalScript, setFinalScript] = useState('');
  const [actualWordCount, setActualWordCount] = useState(0);

  // UI state
  const [copied, setCopied] = useState(false);

  const updateStepStatus = (stepNumber: number, status: StepStatus) => {
    setSteps(prev => prev.map(step =>
      step.number === stepNumber ? { ...step, status } : step
    ));
  };

  const handleGenerate = async () => {
    // Validation
    if (!topic.trim() || !context.trim() || !book.trim()) {
      toast.error('Please fill in all fields (Topic, Context, and Book)');
      return;
    }

    if (targetWordCount < 100) {
      toast.error('Target word count must be at least 100');
      return;
    }

    setStatus('generating');

    // Reset all steps
    setSteps(prev => prev.map(step => ({ ...step, status: 'pending' as StepStatus })));

    // Reset generated data
    setCoreQuestion('');
    setCorePrinciples([]);
    setFinalScript('');
    setActualWordCount(0);

    try {
      // ========================================================================
      // STEP 1: Generate Core Question
      // ========================================================================
      updateStepStatus(1, 'in_progress');

      const step1Response = await fetch('/api/generate/core-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, context, book }),
      });

      if (!step1Response.ok) {
        throw new Error('Failed to generate core question');
      }

      const step1Data = await step1Response.json();
      const generatedCoreQuestion = step1Data.core_question.question;
      setCoreQuestion(generatedCoreQuestion);

      updateStepStatus(1, 'completed');
      toast.success('Core question generated!');

      // ========================================================================
      // STEP 2: Extract Core Principles
      // ========================================================================
      updateStepStatus(2, 'in_progress');

      const step2Response = await fetch('/api/generate/core-principles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book,
          core_question: generatedCoreQuestion,
        }),
      });

      if (!step2Response.ok) {
        throw new Error('Failed to extract core principles');
      }

      const step2Data = await step2Response.json();
      const generatedPrinciples = step2Data.core_principles.principles;
      setCorePrinciples(generatedPrinciples);

      // Format principles as markdown for next steps
      const principlesText = formatPrinciplesAsMarkdown(generatedPrinciples, book);

      updateStepStatus(2, 'completed');
      toast.success(`Extracted ${generatedPrinciples.length} core principles!`);

      // ========================================================================
      // STEP 3: Conduct Augmented Research
      // ========================================================================
      updateStepStatus(3, 'in_progress');

      const step3Response = await fetch('/api/research/augmented', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          core_question: generatedCoreQuestion,
          core_principles_text: principlesText,
          topic,
          book,
        }),
      });

      if (!step3Response.ok) {
        throw new Error('Failed to conduct augmented research');
      }

      const step3Data = await step3Response.json();
      const augmentedResearch = step3Data.augmented_research;

      // Format research as markdown for next step
      const researchText = formatResearchAsMarkdown(augmentedResearch);

      updateStepStatus(3, 'completed');
      toast.success('Research completed!');

      // ========================================================================
      // STEP 4: Generate Script Outline
      // ========================================================================
      updateStepStatus(4, 'in_progress');

      const step4Response = await fetch('/api/generate/script-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          core_question: generatedCoreQuestion,
          core_principles_text: principlesText,
          augmented_research_text: researchText,
        }),
      });

      if (!step4Response.ok) {
        throw new Error('Failed to generate script outline');
      }

      const step4Data = await step4Response.json();
      const outline = step4Data.script_outline;

      // Format outline as markdown for final step
      const outlineText = formatOutlineAsMarkdown(outline);

      updateStepStatus(4, 'completed');
      toast.success('Script outline created!');

      // ========================================================================
      // STEP 5: Generate Final Script with Claude
      // ========================================================================
      updateStepStatus(5, 'in_progress');

      const step5Response = await fetch('/api/generate/final-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          core_question: generatedCoreQuestion,
          book,
          script_outline_text: outlineText,
          target_word_count: targetWordCount,
        }),
      });

      if (!step5Response.ok) {
        throw new Error('Failed to generate final script');
      }

      const step5Data = await step5Response.json();
      const scriptData = step5Data.final_script;

      setFinalScript(scriptData.content);
      setActualWordCount(scriptData.word_count);

      updateStepStatus(5, 'completed');
      toast.success(`Script generated! ${scriptData.word_count} words`);

      setStatus('completed');

    } catch (error) {
      console.error('Generation error:', error);
      setStatus('error');

      // Mark current in-progress step as error
      setSteps(prev => prev.map(step =>
        step.status === 'in_progress' ? { ...step, status: 'error' as StepStatus } : step
      ));

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Generation failed: ${errorMessage}`);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(finalScript);
    setCopied(true);
    toast.success('Script copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">AI Script Engine</h1>
        <p className="text-muted-foreground">
          Transform book wisdom into actionable video scripts
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Input Form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Script Configuration</CardTitle>
              <CardDescription>
                Provide the topic, context, and book to generate a personalized script
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Topic
                </label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Wealth Building"
                  disabled={status === 'generating'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Context (Your Situation)
                </label>
                <Textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g., I'm a 30-year-old, just got a raise, but have student loan debt and don't know where to start."
                  rows={4}
                  disabled={status === 'generating'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Book (Source Material)
                </label>
                <Input
                  value={book}
                  onChange={(e) => setBook(e.target.value)}
                  placeholder='e.g., "The Psychology of Money" by Morgan Housel'
                  disabled={status === 'generating'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Target Word Count
                </label>
                <Input
                  type="number"
                  value={targetWordCount}
                  onChange={(e) => setTargetWordCount(Number(e.target.value))}
                  min={100}
                  max={10000}
                  disabled={status === 'generating'}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Approximate reading time: {Math.round(targetWordCount / 150)} minutes
                </p>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={status === 'generating'}
                className="w-full"
                size="lg"
              >
                {status === 'generating' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Script
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Progress Tracker */}
          {status !== 'idle' && (
            <Card>
              <CardHeader>
                <CardTitle>Generation Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {steps.map((step) => (
                    <div key={step.number} className="flex items-center gap-3">
                      <div className={`
                        flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                        ${step.status === 'completed' ? 'bg-green-500 text-white' : ''}
                        ${step.status === 'in_progress' ? 'bg-blue-500 text-white animate-pulse' : ''}
                        ${step.status === 'pending' ? 'bg-gray-200 text-gray-500' : ''}
                        ${step.status === 'error' ? 'bg-red-500 text-white' : ''}
                      `}>
                        {step.status === 'completed' ? '✓' : step.status === 'error' ? '✗' : step.number}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium
                          ${step.status === 'completed' ? 'text-green-600' : ''}
                          ${step.status === 'in_progress' ? 'text-blue-600' : ''}
                          ${step.status === 'error' ? 'text-red-600' : ''}
                        `}>
                          {step.label}
                        </p>
                      </div>
                      {step.status === 'in_progress' && (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Intermediate Results & Final Output */}
        <div className="space-y-6">
          {/* Core Question */}
          {coreQuestion && (
            <Card>
              <CardHeader>
                <CardTitle>Core Question</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm italic text-muted-foreground">{coreQuestion}</p>
              </CardContent>
            </Card>
          )}

          {/* Core Principles */}
          {corePrinciples.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Core Principles ({corePrinciples.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {corePrinciples.map((principle, index) => (
                    <div key={index} className="border-l-2 border-blue-500 pl-3">
                      <p className="font-medium text-sm">{principle.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{principle.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Final Script */}
          {finalScript && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Final Script</CardTitle>
                  <CardDescription>
                    {actualWordCount} words (target: {targetWordCount})
                  </CardDescription>
                </div>
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
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-sm font-sans bg-gray-50 p-4 rounded-lg">
                    {finalScript}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {status === 'idle' && (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Enter your topic, context, and book to begin</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatPrinciplesAsMarkdown(
  principles: Array<{name: string, description: string}>,
  book: string
): string {
  let markdown = `### Core Principles from "${book}"\n\n`;

  principles.forEach((principle, index) => {
    markdown += `${index + 1}. **Principle Name:** ${principle.name}\n`;
    markdown += `**Description:** ${principle.description}\n`;
    if (index < principles.length - 1) markdown += '\n';
  });

  return markdown;
}

function formatResearchAsMarkdown(augmentedResearch: AugmentedResearch): string {
  let markdown = '### Augmented Research Findings\n\n';

  augmentedResearch.findings_by_principle.forEach((group: FindingGroup) => {
    markdown += `**Supporting Research for: ${group.principle_name}**\n\n`;

    group.findings.forEach((finding: Finding) => {
      markdown += `- **${finding.title}:** ${finding.description}\n`;
    });

    markdown += '\n';
  });

  return markdown;
}

function formatOutlineAsMarkdown(outline: Outline): string {
  let markdown = '### Script Outline\n\n';

  outline.modules.forEach((module: Module, index: number) => {
    markdown += `---\n\n`;
    markdown += `**Module ${index + 1}: ${module.principle_name}**\n\n`;
    markdown += `- **Level 1: The Principle (Why):** ${module.level_1_principle}\n`;
    markdown += `- **Level 2: The Strategy (What):** ${module.level_2_strategy}\n`;
    markdown += `- **Level 3: Actionable Steps (How):**\n`;

    module.level_3_actionable_steps.forEach((step: string) => {
      markdown += `    - ${step}\n`;
    });

    markdown += `- **Level 4: The Reflection Question (Internalize):** ${module.level_4_reflection_question}\n\n`;
  });

  markdown += `---\n`;

  return markdown;
}
