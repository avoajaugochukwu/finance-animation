import { NextRequest, NextResponse } from 'next/server';
import { generateWithClaude } from '@/lib/ai/anthropic';
import { SYSTEM_PROMPT, REWRITE_PROMPT } from '@/lib/prompts/all-prompts';

export const runtime = 'edge';
export const maxDuration = 120;

interface RewriteRequest {
  input_text: string;
  target_word_count: number;
}

/**
 * POST /api/generate/rewrite
 *
 * Standalone sardonic rewriter - transforms any input text into
 * cynical, TTS-ready prose following the established style.
 */
export async function POST(request: NextRequest) {
  try {
    const body: RewriteRequest = await request.json();
    const { input_text, target_word_count } = body;

    // Validation
    if (!input_text || input_text.trim().length < 50) {
      return NextResponse.json(
        { error: 'Input text is required and must be at least 50 characters' },
        { status: 400 }
      );
    }

    if (!target_word_count || target_word_count < 50 || target_word_count > 10000) {
      return NextResponse.json(
        { error: 'Target word count must be between 50 and 10,000' },
        { status: 400 }
      );
    }

    console.log(`[Rewrite] Processing ${countWords(input_text)} words, target: ${target_word_count}`);

    const prompt = REWRITE_PROMPT(input_text, target_word_count);

    // Calculate max tokens based on target word count
    const maxTokens = Math.min(Math.max(target_word_count * 2, 4096), 16384);

    const rewrittenText = await generateWithClaude(
      prompt,
      SYSTEM_PROMPT,
      0.7,
      maxTokens
    );

    if (!rewrittenText || rewrittenText.trim().length === 0) {
      throw new Error('Claude returned empty content');
    }

    const inputWordCount = countWords(input_text);
    const outputWordCount = countWords(rewrittenText);

    console.log(`[Rewrite] Generated: ${outputWordCount} words (target: ${target_word_count})`);

    return NextResponse.json({
      success: true,
      rewritten_text: rewrittenText,
      metadata: {
        input_word_count: inputWordCount,
        output_word_count: outputWordCount,
        target_word_count,
        variance: outputWordCount - target_word_count,
        variance_percentage: ((outputWordCount - target_word_count) / target_word_count * 100).toFixed(1) + '%',
      }
    });

  } catch (error) {
    console.error('[Rewrite] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to rewrite text',
        details: errorMessage,
        troubleshooting: {
          apiConfigured: !!process.env.ANTHROPIC_API_KEY,
          errorType: error instanceof Error ? error.constructor.name : typeof error,
        }
      },
      { status: 500 }
    );
  }
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0)
    .length;
}
