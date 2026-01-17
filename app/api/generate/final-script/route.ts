import { NextRequest, NextResponse } from 'next/server';
import { generateWithClaude } from '@/lib/ai/anthropic';
import { SYSTEM_PROMPT, FINAL_SCRIPT_PROMPT } from '@/lib/prompts/all-prompts';
import { FinalScript } from '@/lib/types';

export const runtime = 'edge';
export const maxDuration = 120; // Claude may take longer for long-form content

interface FinalScriptRequest {
  core_question: string;
  book: string;
  script_outline_text: string; // Formatted markdown text of the outline
  target_word_count: number;
}

/**
 * POST /api/generate/final-script
 *
 * PROMPT 5: Script Generation (uses Claude)
 * Converts structured outline into polished, human-readable script
 */
export async function POST(request: NextRequest) {
  try {
    const body: FinalScriptRequest = await request.json();
    const { core_question, book, script_outline_text, target_word_count } = body;

    // Validation
    if (!core_question || core_question.trim().length === 0) {
      return NextResponse.json(
        { error: 'Core question is required' },
        { status: 400 }
      );
    }

    if (!book || book.trim().length === 0) {
      return NextResponse.json(
        { error: 'Book is required' },
        { status: 400 }
      );
    }

    if (!script_outline_text || script_outline_text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Script outline text is required' },
        { status: 400 }
      );
    }

    if (!target_word_count || target_word_count < 100) {
      return NextResponse.json(
        { error: 'Valid target word count is required (minimum 100)' },
        { status: 400 }
      );
    }

    console.log(`[Final Script] Generating script with Claude for: "${book}"`);
    console.log(`[Final Script] Target word count: ${target_word_count}`);

    const prompt = FINAL_SCRIPT_PROMPT(
      core_question,
      book,
      script_outline_text,
      target_word_count
    );

    // Use Claude for long-form content generation
    const maxTokens = Math.min(Math.max(target_word_count * 2, 8192), 16384);

    const scriptContent = await generateWithClaude(
      prompt,
      SYSTEM_PROMPT,
      0.7,
      maxTokens
    );

    if (!scriptContent || scriptContent.trim().length === 0) {
      throw new Error('Claude returned empty content');
    }

    // Count words in the generated script
    const wordCount = countWords(scriptContent);

    console.log(`[Final Script] Generated script: ${wordCount} words (target: ${target_word_count})`);

    const finalScript: FinalScript = {
      content: scriptContent,
      word_count: wordCount,
      target_word_count,
      book,
      core_question,
      generated_at: new Date(),
    };

    return NextResponse.json({
      success: true,
      final_script: finalScript,
      metadata: {
        word_count: wordCount,
        target_word_count,
        variance: wordCount - target_word_count,
        variance_percentage: ((wordCount - target_word_count) / target_word_count * 100).toFixed(1) + '%',
      }
    });

  } catch (error) {
    console.error('[Final Script] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate final script',
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
