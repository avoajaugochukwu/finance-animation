import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { StyleGuide, CharacterManifest, ColorPalette } from '@/lib/types';

// Build the style guide extraction prompt
function buildStyleGuidePrompt(script: string): string {
  return `You are a Visual Style Director. Your job is to extract character information and define a cohesive visual style from a script.

**IMPORTANT: You are NOT creating scenes or story structure. You are ONLY defining:**
1. Who the characters are and what they look like
2. What visual style should be used
3. What colors represent success/failure in this narrative

### SCRIPT TO ANALYZE:
${script}

### YOUR TASK:

**1. CHARACTER MANIFEST**
Extract ONLY characters who are explicitly mentioned by name or clearly identifiable in the script.
For each character, provide:
- A unique ID (e.g., "char_max", "char_narrator")
- Their name as used in the script
- A detailed visual description for consistent rendering:
  - Gender (male/female/neutral)
  - "stick figure" style with "peach skin #FFDBAC" for hands/face
  - Any distinguishing visual traits (hair style, accessories mentioned)
  - Keep it simple - these are minimalist doodle characters
- Personality traits that affect their expressions (e.g., ["overconfident", "naive"] → smug expressions)
- Optional signature pose if one emerges from the script

**CRITICAL CHARACTER RULES:**
- DO NOT invent characters not in the script
- If the script has no named characters, return an empty character_manifest array
- A narrator who speaks but isn't visualized should NOT be in the manifest
- Only include characters who should appear visually in scenes

**2. GLOBAL VISUAL STYLE**
Based on the script's tone, define the overall visual approach in 1-2 sentences.
Examples:
- "Cynical, high-energy whiteboard sketch with exaggerated expressions"
- "Deadpan minimalist doodles with subtle irony through pose contrast"
- "Frantic scribble energy with chaotic compositions for comedic timing"

**3. COLOR PALETTE**
Define semantic colors based on the script's themes:
- success_color: Hex color for positive moments (default: #00AD43 Market Green)
- failure_color: Hex color for negative moments (default: #FF0000 Danger Red)
- neutral_colors: Array of hex colors for backgrounds and neutral elements (default: ["#FFFFFF", "#000000"])
- usage_guidance: When to use each color based on script themes

### OUTPUT FORMAT (JSON):
{
  "global_visual_style": "Description of the overall visual approach",
  "character_manifest": [
    {
      "id": "char_max",
      "name": "Max",
      "visual_description": "male stick figure, messy spiky hair, peach skin #FFDBAC, wide eager eyes",
      "personality_traits": ["overconfident", "naive", "easily excited"],
      "signature_pose": "chest puffed out, chin up"
    }
  ],
  "color_palette": {
    "success_color": "#00AD43",
    "failure_color": "#FF0000",
    "neutral_colors": ["#FFFFFF", "#000000", "#FFD700"],
    "usage_guidance": "Use success_color for gains and wins, failure_color for losses and crashes, gold (#FFD700) for ironic achievements"
  }
}
`;
}

// Generate the style guide
async function generateStyleGuide(
  openai: OpenAI,
  script: string,
  maxRetries: number = 2
): Promise<{
  global_visual_style: string;
  character_manifest: CharacterManifest[];
  color_palette: ColorPalette;
}> {
  const prompt = buildStyleGuidePrompt(script);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a Visual Style Director who extracts character information and defines visual style guides. You do NOT create scenes or story structure - only character definitions and style parameters.'
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
      });

      const analysis = JSON.parse(completion.choices[0].message.content || '{}');

      // Validate and normalize character manifest
      const characterManifest: CharacterManifest[] = (analysis.character_manifest || []).map(
        (char: Partial<CharacterManifest>) => ({
          id: char.id || `char_${Math.random().toString(36).substr(2, 9)}`,
          name: char.name || 'Unknown',
          visual_description: char.visual_description || 'stick figure with peach skin #FFDBAC',
          personality_traits: char.personality_traits || [],
          signature_pose: char.signature_pose,
        })
      );

      // Validate and normalize color palette
      const colorPalette: ColorPalette = {
        success_color: analysis.color_palette?.success_color || '#00AD43',
        failure_color: analysis.color_palette?.failure_color || '#FF0000',
        neutral_colors: analysis.color_palette?.neutral_colors || ['#FFFFFF', '#000000'],
        usage_guidance: analysis.color_palette?.usage_guidance || 'Use success_color for positive moments, failure_color for negative moments',
      };

      return {
        global_visual_style: analysis.global_visual_style || 'Cynical minimalist whiteboard sketch style',
        character_manifest: characterManifest,
        color_palette: colorPalette,
      };

    } catch (error) {
      lastError = error as Error;
      console.error(`[Style Guide] Generation error (attempt ${attempt + 1}):`, error);
      if (attempt === maxRetries) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Failed to generate style guide');
}

export async function POST(request: NextRequest) {
  try {
    const { script } = await request.json();

    if (!script) {
      return NextResponse.json(
        { error: 'Script is required' },
        { status: 400 }
      );
    }

    console.log(`[Style Guide] Analyzing script for characters and visual style...`);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });

    const result = await generateStyleGuide(openai, script);

    const styleGuide: StyleGuide = {
      global_visual_style: result.global_visual_style,
      character_manifest: result.character_manifest,
      color_palette: result.color_palette,
      generated_at: new Date(),
    };

    console.log(`[Style Guide] Generated style guide with ${styleGuide.character_manifest.length} characters`);

    return NextResponse.json(styleGuide);

  } catch (error) {
    console.error('Style guide analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze script for style guide' },
      { status: 500 }
    );
  }
}
