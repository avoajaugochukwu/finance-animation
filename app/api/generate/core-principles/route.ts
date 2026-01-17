import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient } from '@/lib/ai/openai';
import { SYSTEM_PROMPT, CORE_PRINCIPLES_PROMPT } from '@/lib/prompts/all-prompts';
import { CorePrinciples, CorePrinciple } from '@/lib/types';

export const runtime = 'edge';
export const maxDuration = 60;

interface CorePrinciplesRequest {
  book: string;
  core_question: string;
}

/**
 * POST /api/generate/core-principles
 *
 * PROMPT 2: Core Concept Extraction
 * Extracts 3-5 foundational principles from the specified book
 */
export async function POST(request: NextRequest) {
  try {
    const body: CorePrinciplesRequest = await request.json();
    const { book, core_question } = body;

    // Validation
    if (!book || book.trim().length === 0) {
      return NextResponse.json(
        { error: 'Book is required' },
        { status: 400 }
      );
    }

    if (!core_question || core_question.trim().length === 0) {
      return NextResponse.json(
        { error: 'Core question is required' },
        { status: 400 }
      );
    }

    console.log(`[Core Principles] Extracting principles from: "${book}"`);

    const client = getOpenAIClient();
    const prompt = CORE_PRINCIPLES_PROMPT(book, core_question);

    const response = await client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const generatedText = response.choices[0]?.message?.content || '';

    console.log(`[Core Principles] Raw response:`, generatedText);

    // Parse the principles from the markdown format
    const principles = parsePrinciples(generatedText);

    if (principles.length === 0) {
      throw new Error('Failed to parse principles from response');
    }

    console.log(`[Core Principles] Extracted ${principles.length} principles`);

    const corePrinciples: CorePrinciples = {
      book,
      principles,
      generated_at: new Date(),
    };

    return NextResponse.json({
      success: true,
      core_principles: corePrinciples,
    });

  } catch (error) {
    console.error('[Core Principles] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to extract core principles',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * Parse principles from markdown format:
 * 1. **Principle Name:** Description
 * 2. **Principle Name:** Description
 */
function parsePrinciples(text: string): CorePrinciple[] {
  const principles: CorePrinciple[] = [];

  // Match numbered principles with **Principle Name:** Description format
  const principleRegex = /\d+\.\s*\*\*Principle Name:\*\*\s*([^\n*]+)\s*\*\*Description:\*\*\s*([^\n]+)/gi;

  let match;
  while ((match = principleRegex.exec(text)) !== null) {
    const name = match[1].trim();
    const description = match[2].trim();

    principles.push({ name, description });
  }

  return principles;
}
