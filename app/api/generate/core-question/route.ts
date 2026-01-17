import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient } from '@/lib/ai/openai';
import { SYSTEM_PROMPT, CORE_QUESTION_PROMPT } from '@/lib/prompts/all-prompts';
import { CoreQuestion } from '@/lib/types';

export const runtime = 'edge';
export const maxDuration = 30;

interface CoreQuestionRequest {
  topic: string;
  context: string;
  book: string;
}

/**
 * POST /api/generate/core-question
 *
 * PROMPT 1: Deconstruction & Goal Formulation
 * Synthesizes topic, context, and book into a single Core Question
 */
export async function POST(request: NextRequest) {
  try {
    const body: CoreQuestionRequest = await request.json();
    const { topic, context, book } = body;

    // Validation
    if (!topic || topic.trim().length === 0) {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400 }
      );
    }

    if (!context || context.trim().length === 0) {
      return NextResponse.json(
        { error: 'Context is required' },
        { status: 400 }
      );
    }

    if (!book || book.trim().length === 0) {
      return NextResponse.json(
        { error: 'Book is required' },
        { status: 400 }
      );
    }

    console.log(`[Core Question] Generating core question for: "${topic}"`);

    const client = getOpenAIClient();
    const prompt = CORE_QUESTION_PROMPT(topic, context, book);

    const response = await client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const generatedText = response.choices[0]?.message?.content || '';

    // Extract the question from the response (format: **Core Question:** ...)
    const questionMatch = generatedText.match(/\*\*Core Question:\*\*\s*(.+)/i);
    const question = questionMatch ? questionMatch[1].trim() : generatedText.trim();

    console.log(`[Core Question] Generated: "${question}"`);

    const coreQuestion: CoreQuestion = {
      question,
      topic,
      context,
      book,
      generated_at: new Date(),
    };

    return NextResponse.json({
      success: true,
      core_question: coreQuestion,
    });

  } catch (error) {
    console.error('[Core Question] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate core question',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
