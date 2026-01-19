import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Scene, Character, StyleGuide, CharacterManifest } from '@/lib/types';
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

// Build the system prompt for linear scene generation
function buildSystemPrompt(
  chunkSceneCount: number,
  styleGuide: StyleGuide | null,
  startSceneNumber: number
): string {
  // Build character manifest context if available
  const characterContext = styleGuide?.character_manifest?.length
    ? `
    // --- CHARACTER MANIFEST (Use these EXACT descriptions) ---
    ${styleGuide.character_manifest.map((char: CharacterManifest) =>
      `${char.name} (${char.id}): ${char.visual_description}
       Personality: ${char.personality_traits.join(', ')}${char.signature_pose ? `\n       Default pose: ${char.signature_pose}` : ''}`
    ).join('\n    ')}

    IMPORTANT: When a character appears in a scene, use EXACTLY the visual_description above.
    `
    : '';

  // Build color palette context if available
  const colorContext = styleGuide?.color_palette
    ? `
    // --- COLOR PALETTE ---
    - Success/Positive: ${styleGuide.color_palette.success_color}
    - Failure/Negative: ${styleGuide.color_palette.failure_color}
    - Neutral colors: ${styleGuide.color_palette.neutral_colors.join(', ')}
    - Usage: ${styleGuide.color_palette.usage_guidance}
    `
    : `
    // --- DEFAULT COLOR PALETTE ---
    - Success/Charts UP: Market Green #00AD43
    - Failure/Charts DOWN: Danger Red #FF0000
    - Trophies/Achievements: Sarky Gold #FFD700
    - Character skin: Peach #FFDBAC
    - Background: Pure White #FFFFFF
    `;

  const visualStyle = styleGuide?.global_visual_style
    || 'Cynical Pop doodle (felt-tip marker on white paper)';

  return `You are a TRANSLATOR, not a writer. Your job is to convert script segments into visual scenes SEQUENTIALLY.

    ================================================================================
    🚨 GOLDEN RULE: STRICT LINEAR SEQUENCE 🚨
    ================================================================================

    YOU MUST PROCESS THE SCRIPT LINEARLY.

    - Scene ${startSceneNumber} = the FIRST words of this text segment
    - Scene ${startSceneNumber + 1} = the NEXT ~10-15 words after that
    - And so on...

    You are STRICTLY FORBIDDEN from:
    ❌ Jumping ahead in the script
    ❌ Pulling characters/events from later in the script into early scenes
    ❌ Reordering content for "better flow"
    ❌ Adding characters who haven't been mentioned YET in the current snippet

    If a character is not mentioned in the current ~10-15 word snippet,
    they MUST NOT appear in the visual prompt for that scene.

    ================================================================================

    // --- VISUAL STYLE ---
    ${visualStyle}

    ${characterContext}
    ${colorContext}

    // --- RADICAL MINIMALISM (CRITICAL) ---
    **ONE FOCAL ELEMENT PER SCENE. This is non-negotiable.**

    1. If it's a character scene: ONLY the character (pose/expression tells the story)
    2. If it's a chart scene: ONLY the chart (simple line, one color, one direction)
    3. If it's an object scene: ONLY the object (trophy, wallet, phone)

    **NO TEXT IN IMAGES:**
    - No labels
    - No arrows pointing at things
    - No speech bubbles
    - Let composition and color convey meaning

    **CHARTS ARE SIMPLE:**
    - One line going UP (success color) OR one line going DOWN (failure color)
    - Never both in same chart
    - No axis labels, no numbers, no grid lines

    // --- LIST HANDLING ---
    If the script lists items (e.g., "Paris, London, Tokyo" or "first, second, third"):
    - Option A: Create ONE scene showing multiple elements in the EXACT order mentioned
    - Option B: Create separate rapid-fire scenes for each item
    But items must ALWAYS appear in their original script order. Never reorder.

    // --- LAYOUT TYPES (6 options) ---
    Assign layout_type to EVERY scene:
    1. "character" - Just a character with expression/pose. No props, no background elements.
    2. "object" - Single symbolic object. Trophy. Empty wallet. Phone. One thing only.
    3. "split" - Before/after or expectation/reality contrast. Zig-zag divider.
    4. "overlay" - Stick figure next to dashed placeholder box for meme/image insertion.
    5. "ui" - Fake phone screen, app interface, search results. Single UI element.
    6. "diagram" - Simple chart. ONE line, ONE direction.

    // --- VISUAL PROMPT FORMAT ---
    Keep prompts SHORT (30-50 words). Example:
    ❌ BAD: "Max surrounded by flames, toy blocks labeled 'stocks', chart with arrows saying 'you fail', trophies everywhere"
    ✅ GOOD: "Max with peach skin #FFDBAC, smug expression, holding golden trophy. Pure white background."

    // --- YOUR TASK ---
    1. Split the provided script segment into EXACTLY ${chunkSceneCount} scenes
    2. Each scene should cover approximately 10-15 words from the script
    3. Process the text IN ORDER - scene 1 is the beginning, scene 2 is next, etc.
    4. The script_snippet for each scene MUST be the LITERAL text from that segment
    5. Only include characters in a scene if they are mentioned in THAT scene's snippet

    // --- CHARACTER IDENTIFICATION ---
    - ONLY list characters that ACTUALLY appear in the script segment
    - If no human characters are mentioned, return an empty characters array
    - Use the character IDs from the manifest if provided
    - Description should match the manifest or be EXACTLY 'male' or 'female'

    Return a single JSON object:
    {
      "characters": [
        { "id": "char_1", "name": "Max", "description": "male" }
      ],
      "scenes": [
        {
          "scene_number": ${startSceneNumber},
          "script_snippet": "The LITERAL text from this ~10-15 word segment of the script",
          "visual_prompt": "SHORT prompt (30-50 words). ONE focal element. Must include 'pure white background'.",
          "layout_type": "character" | "object" | "split" | "overlay" | "ui" | "diagram",
          "external_asset_suggestion": "Description of meme/image for overlay" | null,
          "characters": ["char_1"]
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
  styleGuide: StyleGuide | null,
  maxRetries: number = 2
): Promise<ChunkResult> {
  const systemPrompt = buildSystemPrompt(chunkSceneCount, styleGuide, startSceneNumber);

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
    const { script, styleGuide } = await request.json();

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
    if (styleGuide) {
      console.log(`[Scene Analysis] Using style guide with ${styleGuide.character_manifest?.length || 0} characters`);
    }

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
          currentSceneNumber,
          styleGuide as StyleGuide | null
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
      1,
      styleGuide as StyleGuide | null
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
