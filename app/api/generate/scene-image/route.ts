import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { Character, Scene } from '@/lib/types';

const getLayoutDirective = (layoutType?: string): string => {
  switch (layoutType) {
    case 'character':
      return 'Composition: Single character, centered, expression tells the story. No props. ';
    case 'object':
      return 'Composition: Single symbolic object, centered, clean and simple. ';
    case 'split':
      return 'Composition: Split screen with jagged zig-zag vertical divider. Two states only. ';
    case 'overlay':
      return 'Composition: Include dashed rectangular placeholder box for external image overlay. ';
    case 'ui':
      return 'Composition: Single fake UI element (phone screen, app, search results) in marker style. ';
    case 'diagram':
      return 'Composition: Simple chart with ONE line, ONE direction. No axis labels, no numbers. ';
    default:
      return '';
  }
};

interface FalImageResult {
  data?: {
    images: Array<{ url: string }>;
  };
  images?: Array<{ url: string }>;
}

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();
    const { scene, characters } = requestData;

    if (!scene) {
      return NextResponse.json(
        { error: 'Scene data is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.FAL_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'FAL_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // Configure Fal.ai client
    fal.config({
      credentials: apiKey
    });

    // Collect reference images from characters
    const referenceImages: string[] = [];

    // Add character reference images
    if (scene.characters && characters) {
      const sceneCharacters = characters.filter((char: Character) =>
        scene.characters.includes(char.id)
      );

      sceneCharacters.forEach((char: Character) => {
        if (char.reference_image_url) {
          referenceImages.push(char.reference_image_url);
        }
      });
    }

    // Build enhanced prompt with character consistency
    let basePrompt = scene.visual_prompt;

    // Add character descriptions for consistency
    if (scene.characters && characters) {
      const sceneCharacters = characters.filter((char: Character) =>
        scene.characters.includes(char.id)
      );
      if (sceneCharacters.length > 0) {
        const charDescriptions = sceneCharacters.map((char: Character) =>
          `${char.name} (${char.description})`
        ).join(', ');
        basePrompt = `${basePrompt}. Characters in scene: ${charDescriptions}`;
      }
    }

    // Get layout directive based on scene layout type
    const sceneWithLayout = scene as Scene;
    const layoutDirective = getLayoutDirective(sceneWithLayout.layout_type);

    // Apply Casual Finance style to the prompt
    const styledPrompt = `A crude, minimalist felt-tip marker doodle on a pure white background. Simple black line art. No shading. No 3D. No gradients. Characters are stick figures with peach skin fill (#FFDBAC) on heads and hands. 16:9 aspect ratio. Matches the style of 'Casual Finance' YouTube channel exactly.

${layoutDirective}

Scene: ${basePrompt}`;
    
    let result: FalImageResult;
    let apiRequest: Record<string, unknown>;
    let apiEndpoint: string;

    // Use image-to-image if we have reference images, otherwise text-to-image
    if (referenceImages.length > 0) {
      apiEndpoint = "fal-ai/nano-banana/edit";
      apiRequest = {
        input: {
          prompt: styledPrompt,
          image_urls: referenceImages,
          num_images: 1,
          aspect_ratio: "16:9"
        },
        logs: false
      };

      // Use nano-banana/edit for image-to-image with seed references
      result = await fal.subscribe(apiEndpoint, apiRequest) as FalImageResult;
    } else {
      apiEndpoint = "fal-ai/nano-banana";
      apiRequest = {
        input: {
          prompt: styledPrompt,
          num_images: 1,
          aspect_ratio: "16:9"
        },
        logs: false
      };

      // Fall back to text-to-image when no references available
      result = await fal.subscribe(apiEndpoint, apiRequest) as FalImageResult;
    }
    
    // Extract image URL from response (result.data contains the images array)
    const imageUrl = result.data?.images?.[0]?.url || result.images?.[0]?.url;

    if (!imageUrl) {
      throw new Error('No image URL in response');
    }

    return NextResponse.json({
      image_url: imageUrl,
      prompt_used: styledPrompt,
      used_references: referenceImages.length > 0,
      aspect_ratio: '16:9'
    });

  } catch (error) {
    console.error('Scene image generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate scene image' },
      { status: 500 }
    );
  }
}