import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient } from '@/lib/ai/openai';
import { SYSTEM_PROMPT, SCRIPT_OUTLINE_PROMPT } from '@/lib/prompts/all-prompts';
import { ScriptOutline, ScriptModule } from '@/lib/types';

export const runtime = 'edge';
export const maxDuration = 60;

interface ScriptOutlineRequest {
  core_question: string;
  core_principles_text: string; // Formatted markdown text
  augmented_research_text: string; // Formatted markdown text
}

/**
 * POST /api/generate/script-outline
 *
 * PROMPT 4: Synthesis & Structuring
 * Creates 4-level hierarchy modules (principle → strategy → steps → reflection)
 */
export async function POST(request: NextRequest) {
  try {
    const body: ScriptOutlineRequest = await request.json();
    const { core_question, core_principles_text, augmented_research_text } = body;

    // Validation
    if (!core_question || core_question.trim().length === 0) {
      return NextResponse.json(
        { error: 'Core question is required' },
        { status: 400 }
      );
    }

    if (!core_principles_text || core_principles_text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Core principles text is required' },
        { status: 400 }
      );
    }

    if (!augmented_research_text || augmented_research_text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Augmented research text is required' },
        { status: 400 }
      );
    }

    console.log(`[Script Outline] Generating structured outline`);

    const client = getOpenAIClient();
    const prompt = SCRIPT_OUTLINE_PROMPT(
      core_question,
      core_principles_text,
      augmented_research_text
    );

    const response = await client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 3000,
    });

    const generatedText = response.choices[0]?.message?.content || '';

    console.log(`[Script Outline] Raw response:`, generatedText);

    // Parse the modules from the markdown format
    const modules = parseModules(generatedText);

    if (modules.length === 0) {
      throw new Error('Failed to parse modules from response');
    }

    console.log(`[Script Outline] Parsed ${modules.length} modules`);

    const scriptOutline: ScriptOutline = {
      modules,
      core_question,
      generated_at: new Date(),
    };

    return NextResponse.json({
      success: true,
      script_outline: scriptOutline,
    });

  } catch (error) {
    console.error('[Script Outline] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate script outline',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * Parse modules from markdown format:
 * **Module 1: [Principle Name]**
 * - **Level 1: The Principle (Why):** Description
 * - **Level 2: The Strategy (What):** Strategy text
 * - **Level 3: Actionable Steps (How):**
 *     - Step 1
 *     - Step 2
 * - **Level 4: The Reflection Question (Internalize):** Question
 */
function parseModules(text: string): ScriptModule[] {
  const modules: ScriptModule[] = [];

  // Split by module headers
  const moduleRegex = /\*\*Module \d+:\s*([^*\n]+)\*\*/g;
  const matches = Array.from(text.matchAll(moduleRegex));

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const principleName = match[1].trim();
    const startIndex = match.index! + match[0].length;
    const endIndex = i < matches.length - 1 ? matches[i + 1].index! : text.length;
    const moduleText = text.substring(startIndex, endIndex);

    // Parse the 4 levels
    const level1Match = moduleText.match(/\*\*Level 1: The Principle \(Why\):\*\*\s*([^\n]+)/);
    const level2Match = moduleText.match(/\*\*Level 2: The Strategy \(What\):\*\*\s*([^\n]+)/);
    const level3Match = moduleText.match(/\*\*Level 3: Actionable Steps \(How\):\*\*\s*([\s\S]*?)\*\*Level 4:/);
    const level4Match = moduleText.match(/\*\*Level 4: The Reflection Question \(Internalize\):\*\*\s*([^\n]+)/);

    if (!level1Match || !level2Match || !level3Match || !level4Match) {
      console.warn(`[Script Outline] Failed to parse module: ${principleName}`);
      continue;
    }

    const level1 = level1Match[1].trim();
    const level2 = level2Match[1].trim();
    const level3Text = level3Match[1].trim();
    const level4 = level4Match[1].trim();

    // Parse actionable steps (bullet points)
    const steps: string[] = [];
    const stepMatches = level3Text.matchAll(/-\s*([^\n]+)/g);
    for (const stepMatch of stepMatches) {
      const step = stepMatch[1].trim();
      if (step.length > 0) {
        steps.push(step);
      }
    }

    modules.push({
      principle_name: principleName,
      level_1_principle: level1,
      level_2_strategy: level2,
      level_3_actionable_steps: steps,
      level_4_reflection_question: level4,
    });
  }

  return modules;
}
