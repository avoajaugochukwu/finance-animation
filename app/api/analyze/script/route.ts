import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Scene, Character } from '@/lib/types';
import { MAX_SCENES_PER_CHUNK } from '@/lib/config/development';
import { countWords } from '@/lib/utils/word-count';

// Constants for linear scene generation
const WORDS_PER_SCENE = 12; // ~10-15 words per scene for 4s duration

interface RawCharacter {
  id: string;
  name: string;
  description: string;
}

interface RawScene {
  scene_number: number;
  script_snippet: string;
  visual_prompt: string;
  characters?: string[];
  layout_type?: 'split' | 'overlay' | 'ui' | 'diagram' | 'character' | 'object';
  external_asset_suggestion?: string;
}

interface ChunkResult {
  characters: Character[];
  scenes: Scene[];
}

// Build the system prompt for linear scene generation - Casual Finance style hardcoded
function buildSystemPrompt(
  chunkSceneCount: number,
  startSceneNumber: number
): string {
  return `You are a linear storyboard translator for a channel exactly like 'Casual Finance.'

YOUR GOLDEN RULES:
LINEAR ONLY: Scene 1 = First words. Scene 2 = Next words. Never jump ahead.
MAX IS THE DEFAULT: Use Max (male stick figure, messy hair, peach skin) for every scene unless a character like 'Agent' or 'TikTok Bro' is mentioned.
LITERAL ILLUSTRATION: Do not be 'creative' with concepts. If the text says 'Eggs,' draw eggs. If the text says 'Vietnam flashback,' draw Max in a helmet. If the text says 'Palm tree,' draw a palm tree.
NO CHARTS: Never draw a graph or chart unless the text says 'Market,' 'Data,' or 'S&P 500.'
HUMOR THROUGH ABSURDITY: Use the 'Confidence = Abs' logic. If Max is 'disciplined,' show him with a military haircut. If he 'checked mortgage rates,' show him holding a giant calculator.
CHUNK SIZE: 10-12 words per scene.

=== EXAMPLE LIBRARY ===
Use these as reference for the literal + absurd visual style:

| Script Snippet | Visual Prompt |
|----------------|---------------|
| "Meet Max. He works hard." | Max standing next to a gold trophy labeled "Good Guy." |
| "Confidence at an all-time high." | Max with giant exaggerated six-pack abs and a smug face. |
| "His strategy: Buy high, sell higher." | Text on screen: "Strategy" -> "Buy High, Sell Higher" with an arrow. |
| "Risk management: Prayer." | Max kneeling on the floor with hands together in prayer. |
| "Fast forward 3 months." | Large black arrow on screen with text "3 Months Later." |
| "The Fed hikes rates." | Head of Jerome Powell on a "Salt Bae" body sprinkling red downward candles. |
| "Googling how to divorce him." | A literal Google search bar with that text typed in. |
| "Eating at No Malibu." | Max sitting at a table with a sign behind him that says "Nobu Malibu." |
| "Looking for a job at Pei Wei." | Max looking sad in front of a sign that says "Pei Wei: Now Hiring." |
| "The Market is Rigged!!" | Max yelling at a female stick figure (Eve). |

=== HERO CHARACTER ===
Max: Male stick figure, messy spiky black hair, peach skin #FFDBAC on head/hands.

=== OUTPUT FORMAT ===
Generate EXACTLY ${chunkSceneCount} scenes starting at scene ${startSceneNumber}.
Each scene covers ~10-12 words from the script in STRICT order.

Return JSON:
{
  "characters": [
    { "id": "char_max", "name": "Max", "description": "male stick figure, messy spiky black hair, peach skin #FFDBAC" }
  ],
  "scenes": [
    {
      "scene_number": ${startSceneNumber},
      "script_snippet": "LITERAL text from this ~10-12 word segment",
      "visual_prompt": "SHORT prompt (30-50 words). ONE focal element. Pure white background.",
      "layout_type": "character" | "object" | "split" | "overlay" | "ui" | "diagram",
      "external_asset_suggestion": null,
      "characters": ["char_max"]
    }
  ]
}`;
}

// Split script into sentence-respecting chunks
function splitScriptIntoSegments(script: string, wordsPerSegment: number): string[] {
  const sentences = script.match(/[^.!?]+[.!?]+/g) || [script];
  const segments: string[] = [];
  let currentSegment: string[] = [];
  let currentWordCount = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/);
    const sentenceWordCount = sentenceWords.length;

    // If adding this sentence would exceed our target and we have content, start new segment
    if (currentWordCount > 0 && currentWordCount + sentenceWordCount > wordsPerSegment * 1.5) {
      segments.push(currentSegment.join(' ').trim());
      currentSegment = [sentence.trim()];
      currentWordCount = sentenceWordCount;
    } else {
      currentSegment.push(sentence.trim());
      currentWordCount += sentenceWordCount;
    }

    // If we've reached our target, finalize segment
    if (currentWordCount >= wordsPerSegment) {
      segments.push(currentSegment.join(' ').trim());
      currentSegment = [];
      currentWordCount = 0;
    }
  }

  // Don't forget remaining content
  if (currentSegment.length > 0) {
    segments.push(currentSegment.join(' ').trim());
  }

  return segments.filter(s => s.length > 0);
}

// Generate scenes for a single chunk of the script
async function generateScenesForChunk(
  openai: OpenAI,
  chunkScript: string,
  chunkSceneCount: number,
  startSceneNumber: number,
  maxRetries: number = 2
): Promise<ChunkResult> {
  const systemPrompt = buildSystemPrompt(chunkSceneCount, startSceneNumber);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const retryInstruction = attempt > 0
        ? `\n\n🚨 CRITICAL RETRY: Previous attempt failed. You MUST generate EXACTLY ${chunkSceneCount} scenes, starting at scene ${startSceneNumber}. Process the text LINEARLY - do not skip or reorder content.`
        : '';

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt + retryInstruction },
          { role: 'user', content: `SCRIPT SEGMENT TO TRANSLATE (process in order, scene ${startSceneNumber} onwards):\n\n${chunkScript}` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5, // Lower temperature for more consistent sequential processing
        max_tokens: 16384,
      });

      const analysis = JSON.parse(completion.choices[0].message.content || '{}');

      const characters: Character[] = (analysis.characters || []).map((char: RawCharacter) => ({
        id: char.id,
        name: char.name,
        description: char.description,
        is_approved: false
      }));

      // Sort scenes by scene_number from GPT before mapping to ensure correct order
      const rawScenes = (analysis.scenes || []).sort(
        (a: RawScene, b: RawScene) => a.scene_number - b.scene_number
      );

      const scenes: Scene[] = rawScenes.map((scene: RawScene, idx: number) => ({
        scene_number: startSceneNumber + idx,
        script_snippet: scene.script_snippet,
        visual_prompt: scene.visual_prompt,
        characters: scene.characters || [],
        layout_type: scene.layout_type,
        external_asset_suggestion: scene.external_asset_suggestion,
      }));

      // Validate scene count with 15% tolerance
      const actualScenes = scenes.length;
      const tolerance = 0.15;
      const minExpected = Math.floor(chunkSceneCount * (1 - tolerance));

      if (actualScenes < minExpected && attempt < maxRetries) {
        console.warn(`[Scene Analysis] Chunk expected ${chunkSceneCount} scenes, got ${actualScenes}. Retrying (attempt ${attempt + 1})...`);
        continue;
      }

      if (actualScenes < minExpected) {
        console.warn(`[Scene Analysis] Final attempt: expected ${chunkSceneCount} scenes, got ${actualScenes}. Proceeding with available scenes.`);
      }

      return { characters, scenes };

    } catch (error) {
      lastError = error as Error;
      console.error(`[Scene Analysis] Chunk generation error (attempt ${attempt + 1}):`, error);
      if (attempt === maxRetries) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Failed to generate scenes for chunk');
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

    // Calculate number of scenes based on ~10-15 words per scene
    const wordCount = countWords(script);
    const totalScenes = Math.ceil(wordCount / WORDS_PER_SCENE);

    console.log(`[Scene Analysis] Script: ${wordCount} words, ${totalScenes} scenes expected (~${WORDS_PER_SCENE} words/scene)`);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });

    // Determine if chunking is needed
    const chunks = Math.ceil(totalScenes / MAX_SCENES_PER_CHUNK);

    if (chunks > 1) {
      // Chunked processing for long scripts
      console.log(`[Scene Analysis] Processing in ${chunks} chunks (${MAX_SCENES_PER_CHUNK} scenes per chunk)`);

      // Split script into segments that respect sentence boundaries
      const scriptSegments = splitScriptIntoSegments(script, MAX_SCENES_PER_CHUNK * WORDS_PER_SCENE);

      const allScenes: Scene[] = [];
      const allCharacters: Character[] = [];
      let currentSceneNumber = 1;

      for (let i = 0; i < scriptSegments.length; i++) {
        const chunkScript = scriptSegments[i];
        const chunkWordCount = countWords(chunkScript);
        const chunkSceneCount = Math.ceil(chunkWordCount / WORDS_PER_SCENE);

        console.log(`[Scene Analysis] Processing chunk ${i + 1}/${scriptSegments.length}: ${chunkWordCount} words, ${chunkSceneCount} scenes (starting at scene ${currentSceneNumber})`);

        const chunkResult = await generateScenesForChunk(
          openai,
          chunkScript,
          chunkSceneCount,
          currentSceneNumber
        );

        allScenes.push(...chunkResult.scenes);

        // Merge characters (deduplicate by name)
        chunkResult.characters.forEach(char => {
          if (!allCharacters.find(c => c.name === char.name)) {
            allCharacters.push(char);
          }
        });

        // Update scene number for next chunk
        currentSceneNumber += chunkResult.scenes.length;

        console.log(`[Scene Analysis] Chunk ${i + 1} complete: ${chunkResult.scenes.length} scenes generated`);
      }

      // Sort all scenes by scene_number to ensure final order is correct
      allScenes.sort((a, b) => a.scene_number - b.scene_number);

      console.log(`[Scene Analysis] Total scenes generated: ${allScenes.length} (expected: ${totalScenes})`);

      return NextResponse.json({
        characters: allCharacters,
        scenes: allScenes
      });
    }

    // Single-chunk processing for shorter scripts
    console.log(`[Scene Analysis] Single-chunk processing (${totalScenes} scenes)`);

    const result = await generateScenesForChunk(
      openai,
      script,
      totalScenes,
      1
    );

    console.log(`[Scene Analysis] Generated ${result.scenes.length} scenes (expected: ${totalScenes})`);

    return NextResponse.json({
      characters: result.characters,
      scenes: result.scenes
    });

  } catch (error) {
    console.error('Script analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze script' },
      { status: 500 }
    );
  }
}
