import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { NarrativeContext, SceneBrief } from '@/lib/types';
import { SCENE_DURATION_SECONDS, MAX_SCENES_PER_CHUNK } from '@/lib/config/development';
import { countWords } from '@/lib/utils/word-count';

// Chunked narrative analysis prompt
function buildNarrativeChunkPrompt(
  chunkScript: string,
  chunkSceneCount: number,
  startSceneNumber: number,
  isFirstChunk: boolean
): string {
  const contextIntro = isFirstChunk
    ? `You are a Visual Story Architect. Your job is to analyze a script and create a scene-by-scene brief that captures the NARRATIVE FLOW, not just literal content.`
    : `You are a Visual Story Architect continuing your analysis of a script. Generate scene briefs for this portion of the script.`;

  return `
${contextIntro}

### SCRIPT CHUNK TO ANALYZE:
${chunkScript}

### YOUR TASK:
Break this into ${chunkSceneCount} scenes, starting from scene ${startSceneNumber}. For EACH scene, identify:

1. **FOCAL ELEMENT**: The ONE thing to show. Not three things. ONE.
   - If introducing a character: just the character
   - If showing success: ONE symbol (trophy, green chart, thumbs up)
   - If showing failure: ONE symbol (red chart, empty wallet, facepalm)

2. **EMOTIONAL BEAT**: What feeling should viewer get?
   - "false confidence" / "crushing realization" / "smug satisfaction" / "quiet despair"

3. **VISUAL TONE**: triumphant | defeated | neutral | chaotic | calm

4. **NARRATIVE ROLE**: Why does this scene exist in the story?
   - "introduces protagonist's flaw"
   - "escalates the stakes"
   - "delivers the punchline"

5. **LAYOUT TYPE**: Choose the best layout for this scene:
   - "character" - Just a character with expression/pose
   - "object" - Single symbolic object (trophy, chart, phone)
   - "split" - Before/after or expectation/reality contrast
   - "overlay" - Scene needs a real meme/image inserted later
   - "ui" - Fake phone screen, app interface, search results
   - "diagram" - Simple chart or graph (one line, one direction)

6. **OVERLAY SUGGESTION** (for overlay layouts only):
   - Describe what real image/meme should be inserted
   - Examples: "Leonardo DiCaprio laughing Wolf of Wall Street", "This is fine dog meme", "Crying Jordan face"

### CRITICAL RULES:
- NEVER suggest showing multiple elements that could be separate scenes
- PREFER character reactions over abstract concepts
- SARCASM comes from CONTRAST between scenes, not clutter within scenes
- Charts should be SIMPLE: one line, one direction (up OR down, never both)
- NO text labels inside the image - let composition speak
- You MUST generate EXACTLY ${chunkSceneCount} scene briefs
- Scene numbers MUST start at ${startSceneNumber}

### OUTPUT FORMAT (JSON):
{
  ${isFirstChunk ? `"story_arc": "brief description of the narrative",
  "key_themes": ["theme1", "theme2"],
  "emotional_progression": ["emotion1", "emotion2", ...],` : ''}
  "scene_briefs": [
    {
      "scene_number": ${startSceneNumber},
      "focal_element": "Max standing proudly with golden trophy",
      "emotional_beat": "false confidence",
      "visual_tone": "triumphant",
      "narrative_role": "establishes Max's dangerous overconfidence",
      "connects_to": [],
      "layout_type": "character",
      "overlay_suggestion": null
    }
    // ... continue for all ${chunkSceneCount} scenes
  ]
}
`;
}

// Generate scene briefs for a single chunk
async function generateNarrativeBriefsForChunk(
  openai: OpenAI,
  chunkScript: string,
  chunkSceneCount: number,
  startSceneNumber: number,
  isFirstChunk: boolean,
  maxRetries: number = 2
): Promise<{
  story_arc?: string;
  key_themes?: string[];
  emotional_progression?: string[];
  scene_briefs: SceneBrief[];
}> {
  const prompt = buildNarrativeChunkPrompt(chunkScript, chunkSceneCount, startSceneNumber, isFirstChunk);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const retryInstruction = attempt > 0
        ? `\n\nCRITICAL RETRY: Previous attempt returned too few scene briefs. You MUST generate EXACTLY ${chunkSceneCount} scene briefs starting at scene ${startSceneNumber}.`
        : '';

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a Visual Story Architect specializing in minimalist visual storytelling. You understand narrative arcs, emotional beats, and how to convey meaning through single focal elements rather than cluttered compositions.'
          },
          { role: 'user', content: prompt + retryInstruction }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const analysis = JSON.parse(completion.choices[0].message.content || '{}');
      const sceneBriefs = analysis.scene_briefs || [];

      // Validate scene count with 15% tolerance
      const actualBriefs = sceneBriefs.length;
      const tolerance = 0.15;
      const minExpected = Math.floor(chunkSceneCount * (1 - tolerance));

      if (actualBriefs < minExpected && attempt < maxRetries) {
        console.warn(`[Narrative Analysis] Chunk expected ${chunkSceneCount} briefs, got ${actualBriefs}. Retrying (attempt ${attempt + 1})...`);
        continue;
      }

      if (actualBriefs < minExpected) {
        console.warn(`[Narrative Analysis] Final attempt: expected ${chunkSceneCount} briefs, got ${actualBriefs}. Proceeding with available briefs.`);
      }

      return {
        story_arc: analysis.story_arc,
        key_themes: analysis.key_themes,
        emotional_progression: analysis.emotional_progression,
        scene_briefs: sceneBriefs,
      };

    } catch (error) {
      lastError = error as Error;
      console.error(`[Narrative Analysis] Chunk generation error (attempt ${attempt + 1}):`, error);
      if (attempt === maxRetries) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Failed to generate narrative briefs for chunk');
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

    // Calculate scenes based on script length
    const wordCount = countWords(script);
    const estimatedMinutes = Math.ceil(wordCount / 150);
    const totalScenes = Math.round((estimatedMinutes * 60) / SCENE_DURATION_SECONDS);

    console.log(`[Narrative Analysis] Script: ${wordCount} words, planning ${totalScenes} scenes`);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });

    // Determine if chunking is needed
    const chunks = Math.ceil(totalScenes / MAX_SCENES_PER_CHUNK);

    if (chunks > 1) {
      // Chunked processing for long scripts
      console.log(`[Narrative Analysis] Processing in ${chunks} chunks (${MAX_SCENES_PER_CHUNK} scenes per chunk)`);

      const words = script.split(/\s+/);
      const wordsPerChunk = Math.ceil(words.length / chunks);

      const allSceneBriefs: SceneBrief[] = [];
      let storyArc = '';
      let keyThemes: string[] = [];
      let emotionalProgression: string[] = [];

      for (let i = 0; i < chunks; i++) {
        const chunkStart = i * wordsPerChunk;
        const chunkEnd = Math.min((i + 1) * wordsPerChunk, words.length);
        const chunkScript = words.slice(chunkStart, chunkEnd).join(' ');
        const chunkSceneCount = i === chunks - 1
          ? totalScenes - (i * MAX_SCENES_PER_CHUNK)
          : MAX_SCENES_PER_CHUNK;
        const startSceneNumber = i * MAX_SCENES_PER_CHUNK + 1;
        const isFirstChunk = i === 0;

        console.log(`[Narrative Analysis] Processing chunk ${i + 1}/${chunks}: ${chunkEnd - chunkStart} words, ${chunkSceneCount} scene briefs (starting at ${startSceneNumber})`);

        const chunkResult = await generateNarrativeBriefsForChunk(
          openai,
          chunkScript,
          chunkSceneCount,
          startSceneNumber,
          isFirstChunk
        );

        // Capture metadata from first chunk
        if (isFirstChunk) {
          storyArc = chunkResult.story_arc || '';
          keyThemes = chunkResult.key_themes || [];
          emotionalProgression = chunkResult.emotional_progression || [];
        }

        allSceneBriefs.push(...chunkResult.scene_briefs);
        console.log(`[Narrative Analysis] Chunk ${i + 1} complete: ${chunkResult.scene_briefs.length} scene briefs generated`);
      }

      const narrativeContext: NarrativeContext = {
        story_arc: storyArc,
        key_themes: keyThemes,
        emotional_progression: emotionalProgression,
        scene_briefs: allSceneBriefs,
        generated_at: new Date(),
      };

      console.log(`[Narrative Analysis] Total scene briefs generated: ${allSceneBriefs.length} (expected: ${totalScenes})`);

      return NextResponse.json(narrativeContext);
    }

    // Single-chunk processing for shorter scripts
    console.log(`[Narrative Analysis] Single-chunk processing (${totalScenes} scenes)`);

    const result = await generateNarrativeBriefsForChunk(
      openai,
      script,
      totalScenes,
      1,
      true
    );

    const narrativeContext: NarrativeContext = {
      story_arc: result.story_arc || '',
      key_themes: result.key_themes || [],
      emotional_progression: result.emotional_progression || [],
      scene_briefs: result.scene_briefs,
      generated_at: new Date(),
    };

    console.log(`[Narrative Analysis] Generated ${narrativeContext.scene_briefs.length} scene briefs (expected: ${totalScenes})`);

    return NextResponse.json(narrativeContext);

  } catch (error) {
    console.error('Narrative analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze narrative' },
      { status: 500 }
    );
  }
}
