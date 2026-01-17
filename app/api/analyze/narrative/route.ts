import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { NarrativeContext } from '@/lib/types';
import { SCENE_DURATION_SECONDS } from '@/lib/config/development';
import { countWords } from '@/lib/utils/word-count';
import { NARRATIVE_ANALYSIS_PROMPT } from '@/lib/prompts/all-prompts';

export async function POST(request: NextRequest) {
  try {
    const { script } = await request.json();

    if (!script) {
      return NextResponse.json(
        { error: 'Script is required' },
        { status: 400 }
      );
    }

    // Calculate scenes based on script length
    const wordCount = countWords(script);
    const estimatedMinutes = Math.ceil(wordCount / 150);
    const totalScenes = Math.round((estimatedMinutes * 60) / SCENE_DURATION_SECONDS);

    console.log(`[Narrative Analysis] Script: ${wordCount} words, planning ${totalScenes} scenes`);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a Visual Story Architect specializing in minimalist visual storytelling. You understand narrative arcs, emotional beats, and how to convey meaning through single focal elements rather than cluttered compositions.'
        },
        { role: 'user', content: NARRATIVE_ANALYSIS_PROMPT(script, totalScenes) }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const analysis = JSON.parse(completion.choices[0].message.content || '{}');

    const narrativeContext: NarrativeContext = {
      story_arc: analysis.story_arc || '',
      key_themes: analysis.key_themes || [],
      emotional_progression: analysis.emotional_progression || [],
      scene_briefs: analysis.scene_briefs || [],
      generated_at: new Date(),
    };

    console.log(`[Narrative Analysis] Generated ${narrativeContext.scene_briefs.length} scene briefs`);

    return NextResponse.json(narrativeContext);

  } catch (error) {
    console.error('Narrative analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze narrative' },
      { status: 500 }
    );
  }
}
