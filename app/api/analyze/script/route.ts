import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Scene, Character, NarrativeContext, SceneBrief } from '@/lib/types';
import { SCENE_DURATION_SECONDS, MAX_SCENES_PER_CHUNK } from '@/lib/config/development';
import { countWords } from '@/lib/utils/word-count';

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

// Build the system prompt for scene generation
function buildSystemPrompt(
  chunkSceneCount: number,
  sceneBriefsContext: string,
  visualMetaphors: string[]
): string {
  return `You are a Lead Concept Artist for a cynical explainer YouTube channel (Casually Explained / Sam O'Nella style). Your job is to transform a sardonic script into RADICALLY MINIMALIST visual scenes using the "Cynical Pop" aesthetic.

    ${sceneBriefsContext}

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
    - One line going UP (green) OR one line going DOWN (red)
    - Never both in same chart
    - No axis labels, no numbers, no grid lines

    // --- CYNICAL POP COLOR PALETTE ---
    MANDATORY COLORS (use exact hex values in prompts):
    - Character skin: Peach #FFDBAC for Max/Mia heads and hands
    - Success/Charts UP: Market Green #00AD43
    - Failure/Charts DOWN: Danger Red #FF0000
    - Trophies/Achievements: Sarky Gold #FFD700
    - Background: Pure White #FFFFFF
    - Line art: Black

    // --- CORE VISUAL STYLE ---
    The visual style is **Cynical Pop doodle (felt-tip marker on white paper)**:
    1.  **Characters:** Crude stick figures with peach (#FFDBAC) filled heads. Use the names provided in the script. If a character is male, use the script's name (e.g., Max); if female, use the script's name (e.g., Mia).
    2.  **Background:** ALWAYS pure white. No exceptions.
    3.  **Single focal point:** One element per scene. Sarcasm comes from scene SEQUENCE, not clutter.

    // --- LAYOUT TYPES (6 options) ---
    Assign layout_type to EVERY scene:
    1. "character" - Just a character with expression/pose. No props, no background elements.
    2. "object" - Single symbolic object. Trophy. Empty wallet. Phone. One thing only.
    3. "split" - Before/after or expectation/reality contrast. Zig-zag divider.
    4. "overlay" - Stick figure next to dashed placeholder box for meme/image insertion.
    5. "ui" - Fake phone screen, app interface, search results. Single UI element.
    6. "diagram" - Simple chart. ONE line, ONE direction.

    // --- LAYOUT REQUIREMENTS ---
    - Mix layouts for variety
    - For 'overlay' layouts, set external_asset_suggestion to describe what meme/image to overlay
    - For non-overlay layouts, set external_asset_suggestion to null

    // --- COLOR CONTEXT RULES ---
    - Script mentions SUCCESS/WINNING → Use Market Green #00AD43
    - Script mentions FAILURE/DEBT → Use Danger Red #FF0000
    - Ironic achievements → Use Sarky Gold #FFD700

    // --- VISUAL PROMPT FORMAT ---
    Keep prompts SHORT (30-50 words). Example:
    ❌ BAD: "Max surrounded by flames, toy blocks labeled 'stocks', chart with arrows saying 'you fail', trophies everywhere"
    ✅ GOOD: "Max with peach skin, smug expression, holding golden trophy. Pure white background."

    // --- FORBIDDEN ---
    NO: Text labels, arrows, multiple competing elements, complex diagrams, crowded compositions.
    YES: Single focal point, clean composition, emotional clarity through expression/pose.

    ${
      visualMetaphors.length > 0
        ? `
    // --- SCRIPT-SPECIFIC METAPHORS ---
    These were suggested but simplify them to ONE focal element:
    ${visualMetaphors.map((metaphor, idx) => `    ${idx + 1}. ${metaphor}`).join('\n')}
    `
        : ""
    }
    // --- YOUR TASK ---
    Analyze the provided script and perform the following tasks:

    1.  **Identify ONLY human characters that appear in the provided script.**
        *   DO NOT hallucinate characters. If the script only mentions one character name, the characters list should ONLY contain that character.
        *   DO NOT include "Mia" or any other character unless they are explicitly mentioned or perform an action in the script.
        *   Description MUST be EXACTLY 'male' or 'female'.
        *   DO NOT add objects, animals, or non-human entities to the characters list.
        *   If a scene has no human characters, the characters array MUST be empty [].

    2.  **Break the script into exactly ${chunkSceneCount} visual scenes.**
        *   CRITICAL: You MUST generate EXACTLY ${chunkSceneCount} scenes. Not fewer, not more.
        *   Break down the script into small segments - approximately every 1-2 sentences should be a separate scene.
        *   Each scene represents ~4 seconds of video content.

    3.  **For EACH scene, generate a MINIMALIST visual prompt:**
        *   ONE focal element only
        *   Keep prompts SHORT (30-50 words)
        *   Characters MUST have peach skin tone (#FFDBAC)
        *   NO text labels or arrows
        *   Every visual_prompt MUST include "pure white background"

        Return a single JSON object with this exact structure:
        {
          "characters": [
            { "id": "character_1", "name": "Max", "description": "male" }
          ],
          "scenes": [
            {
              "scene_number": 1,
              "script_snippet": "MUST contain the actual 1-3 sentences from the user's script for this scene.",
              "visual_prompt": "SHORT (30-50 words). ONE focal element. Include peach skin tone (#FFDBAC) if character. Must include 'pure white background'.",
              "layout_type": "character" | "object" | "split" | "overlay" | "ui" | "diagram",
              "external_asset_suggestion": "Description of meme/image for overlay" | null,
              "characters": ["character_1"]
            }
          ]
    }`;
}

// Generate scenes for a single chunk of the script
async function generateScenesForChunk(
  openai: OpenAI,
  chunkScript: string,
  chunkSceneCount: number,
  startSceneNumber: number,
  sceneBriefsContext: string,
  visualMetaphors: string[],
  maxRetries: number = 2
): Promise<ChunkResult> {
  const systemPrompt = buildSystemPrompt(chunkSceneCount, sceneBriefsContext, visualMetaphors);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const retryInstruction = attempt > 0
        ? `\n\nCRITICAL RETRY: Previous attempt returned too few scenes. You MUST generate EXACTLY ${chunkSceneCount} scenes. Break the script into smaller segments.`
        : '';

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt + retryInstruction },
          { role: 'user', content: chunkScript }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 16384,
      });

      const analysis = JSON.parse(completion.choices[0].message.content || '{}');

      const characters: Character[] = (analysis.characters || []).map((char: RawCharacter) => ({
        id: char.id,
        name: char.name,
        description: char.description,
        is_approved: false
      }));

      const scenes: Scene[] = (analysis.scenes || []).map((scene: RawScene, idx: number) => ({
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
    const { script, outline, narrativeContext } = await request.json();

    if (!script) {
      return NextResponse.json(
        { error: 'Script is required' },
        { status: 400 }
      );
    }

    // Extract visual metaphor ideas from outline if provided
    const visualMetaphors: string[] = [];
    if (outline?.acts) {
      for (const act of outline.acts) {
        for (const section of act.sections || []) {
          if (section.visual_metaphor_idea) {
            visualMetaphors.push(section.visual_metaphor_idea);
          }
        }
      }
    }

    // Calculate number of scenes based on actual script length
    // Use 150 words per minute as average narration speed
    const wordCount = countWords(script);
    const estimatedDurationMinutes = Math.ceil(wordCount / 150);
    const totalScenes = Math.round((estimatedDurationMinutes * 60) / SCENE_DURATION_SECONDS);

    console.log(`[Scene Analysis] Script: ${wordCount} words, ${totalScenes} scenes expected`);
    if (narrativeContext) {
      console.log(`[Scene Analysis] Using narrative context with ${narrativeContext.scene_briefs?.length || 0} scene briefs`);
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });

    // Build context from narrative analysis if available
    const sceneBriefsContext = (narrativeContext as NarrativeContext)?.scene_briefs
      ? `
    // --- NARRATIVE CONTEXT (from pre-analysis) ---
    Story Arc: ${(narrativeContext as NarrativeContext).story_arc}
    Key Themes: ${(narrativeContext as NarrativeContext).key_themes?.join(', ')}

    SCENE BRIEFS - Follow these focal elements for each scene:
    ${(narrativeContext as NarrativeContext).scene_briefs.map((b: SceneBrief) =>
      `Scene ${b.scene_number}: "${b.focal_element}" (${b.emotional_beat}) - Layout: ${b.layout_type}${b.overlay_suggestion ? ` - Overlay: ${b.overlay_suggestion}` : ''}`
    ).join('\n    ')}

    IMPORTANT: Use the focal elements above as your guide. Each scene should have ONE focal element as specified.
    `
      : '';

    // Determine if chunking is needed
    const chunks = Math.ceil(totalScenes / MAX_SCENES_PER_CHUNK);

    if (chunks > 1) {
      // Chunked processing for long scripts
      console.log(`[Scene Analysis] Processing in ${chunks} chunks (${MAX_SCENES_PER_CHUNK} scenes per chunk)`);

      const words = script.split(/\s+/);
      const wordsPerChunk = Math.ceil(words.length / chunks);

      const allScenes: Scene[] = [];
      const allCharacters: Character[] = [];

      for (let i = 0; i < chunks; i++) {
        const chunkStart = i * wordsPerChunk;
        const chunkEnd = Math.min((i + 1) * wordsPerChunk, words.length);
        const chunkScript = words.slice(chunkStart, chunkEnd).join(' ');
        const chunkSceneCount = i === chunks - 1
          ? totalScenes - (i * MAX_SCENES_PER_CHUNK) // Last chunk gets remainder
          : MAX_SCENES_PER_CHUNK;
        const startSceneNumber = i * MAX_SCENES_PER_CHUNK + 1;

        console.log(`[Scene Analysis] Processing chunk ${i + 1}/${chunks}: ${chunkEnd - chunkStart} words, ${chunkSceneCount} scenes (starting at ${startSceneNumber})`);

        // Get relevant scene briefs for this chunk
        const chunkSceneBriefsContext = (narrativeContext as NarrativeContext)?.scene_briefs
          ? (() => {
              const relevantBriefs = (narrativeContext as NarrativeContext).scene_briefs.filter(
                (b: SceneBrief) => b.scene_number >= startSceneNumber && b.scene_number < startSceneNumber + chunkSceneCount
              );
              if (relevantBriefs.length === 0) return sceneBriefsContext;
              return `
    // --- NARRATIVE CONTEXT (from pre-analysis) ---
    Story Arc: ${(narrativeContext as NarrativeContext).story_arc}
    Key Themes: ${(narrativeContext as NarrativeContext).key_themes?.join(', ')}

    SCENE BRIEFS - Follow these focal elements for each scene:
    ${relevantBriefs.map((b: SceneBrief) =>
      `Scene ${b.scene_number}: "${b.focal_element}" (${b.emotional_beat}) - Layout: ${b.layout_type}${b.overlay_suggestion ? ` - Overlay: ${b.overlay_suggestion}` : ''}`
    ).join('\n    ')}

    IMPORTANT: Use the focal elements above as your guide. Each scene should have ONE focal element as specified.
    `;
            })()
          : '';

        const chunkResult = await generateScenesForChunk(
          openai,
          chunkScript,
          chunkSceneCount,
          startSceneNumber,
          chunkSceneBriefsContext,
          visualMetaphors
        );

        allScenes.push(...chunkResult.scenes);

        // Merge characters (deduplicate by name)
        chunkResult.characters.forEach(char => {
          if (!allCharacters.find(c => c.name === char.name)) {
            allCharacters.push(char);
          }
        });

        console.log(`[Scene Analysis] Chunk ${i + 1} complete: ${chunkResult.scenes.length} scenes generated`);
      }

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
      sceneBriefsContext,
      visualMetaphors
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