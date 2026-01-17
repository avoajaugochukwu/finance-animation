import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { readFileSync } from 'fs';
import { join } from 'path';

interface FalImageResult {
  data?: {
    images: Array<{ url: string }>;
  };
  images?: Array<{ url: string }>;
}

interface ReframeResult {
  data?: {
    images: Array<{ url: string }>;
  };
  images?: Array<{ url: string }>;
}

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();
    const { character, reframe = false, aspectRatio = 'portrait_16_9', referenceImagePath } = requestData;

    if (!character) {
      return NextResponse.json(
        { error: 'Character data is required' },
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

    // Build prompt directly from simple description
    const description = character.description.toLowerCase().trim();
    let styledPrompt: string;

    // Check if it's an animal (contains animal keywords)
    const animalKeywords = ['dog', 'cat', 'bird', 'lion', 'tiger', 'bear', 'rabbit', 'fox', 'wolf', 'elephant', 'giraffe', 'monkey', 'panda', 'koala', 'penguin', 'owl', 'deer', 'squirrel', 'mouse', 'rat', 'hamster', 'fish', 'shark', 'whale', 'dolphin', 'octopus', 'crab', 'turtle', 'snake', 'lizard', 'frog', 'butterfly', 'bee', 'ant', 'spider', 'dragon', 'unicorn', 'dinosaur'];
    const isAnimal = animalKeywords.some(keyword => description.includes(keyword));

    if (isAnimal) {
      // For animals: simple doodle style matching the cynical aesthetic
      styledPrompt = `A simple, crude doodle of a ${character.description}. Minimalist felt-tip marker style. Black line art on pure white background. Sketchy, imperfect lines. Can have one muted accent color. The style is low-effort but charming, like a quick whiteboard sketch.`;
    } else if (description === 'male') {
      // "Max" - extract male by removing female from reference
      styledPrompt = `Remove the female character with bob hair from this image. Keep ONLY the male stick figure with spiky messy black hair exactly as shown. Pure white background. Do not modify the male character at all.`;
    } else if (description === 'female') {
      // "Mia" - extract female by removing male from reference
      styledPrompt = `Remove the male character with spiky hair from this image. Keep ONLY the female stick figure with smooth black bob hair exactly as shown. Pure white background. Do not modify the female character at all.`;
    } else {
      // For objects and other non-human characters - cynical doodle style
      styledPrompt = `${character.description}. A crude, minimalist doodle. Felt-tip marker style on pure white background. Simple black line art with optional single muted accent color. Sketchy, imperfect lines as if drawn quickly. Can have a simple face if appropriate (dot eyes, simple mouth).`;
    }

    console.log('📝 Character Prompt Generation:', {
      characterName: character.name,
      originalDescription: character.description,
      detectedType: isAnimal ? 'animal' :
                    description === 'male' ? 'max' :
                    description === 'female' ? 'mia' : 'other',
      generatedPrompt: styledPrompt
    });

    // Handle reference image if provided - upload to fal.ai storage
    let uploadedImageUrl: string | undefined;
    if (referenceImagePath) {
      try {
        // Read the file from the public directory
        const filePath = join(process.cwd(), 'public', referenceImagePath.replace(/^\//, ''));
        const fileBuffer = readFileSync(filePath);

        // Determine mime type from file extension
        const extension = referenceImagePath.split('.').pop()?.toLowerCase();
        const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';

        // Create File object from buffer
        const file = new File([fileBuffer], referenceImagePath, { type: mimeType });

        // Upload to fal.ai storage
        uploadedImageUrl = await fal.storage.upload(file);

        console.log('📤 Reference Image Upload:', {
          originalPath: referenceImagePath,
          uploadedUrl: uploadedImageUrl
        });
      } catch (fileError) {
        console.error('Error uploading reference image:', fileError);
        // Continue without reference image if upload fails
      }
    }

    // Call Fal.ai API using the client
    let apiEndpoint: string;
    let apiRequest: Record<string, unknown>;

    if (uploadedImageUrl) {
      // Use image-to-image with reference
      apiEndpoint = "fal-ai/nano-banana/edit";
      apiRequest = {
        input: {
          prompt: `${styledPrompt}

AVOID: multiple characters, multiple poses, action poses, gestures, emotions, variations, duplicates, movement, dynamic poses, cartoon scenes with multiple figures`,
          image_urls: [uploadedImageUrl],
          num_images: 1,
          strength: 0.85  // Higher strength to better match reference
        },
        logs: false
      };
      console.log('🎨 Character Generation API Call:', {
        endpoint: apiEndpoint,
        prompt: styledPrompt,
        image_urls: [uploadedImageUrl]
      });
    } else {
      // Use text-to-image
      apiEndpoint = "fal-ai/nano-banana";
      apiRequest = {
        input: {
          prompt: `${styledPrompt}

AVOID: multiple characters, multiple poses, action poses, gestures, variations, duplicates, movement, dynamic poses`,
          num_images: 1
        },
        logs: false
      };
      console.log('🎨 Character Generation API Call:', {
        endpoint: apiEndpoint,
        prompt: styledPrompt,
        no_reference: true
      });
    }

    const result = await fal.subscribe(apiEndpoint, apiRequest) as FalImageResult;
    
    // Extract image URL from response (result.data contains the images array)
    const originalImageUrl = result.data?.images?.[0]?.url || result.images?.[0]?.url;
    
    if (!originalImageUrl) {
      throw new Error('No image URL in response');
    }

    // Optionally reframe the image if requested
    let finalImageUrl = originalImageUrl;
    
    if (reframe) {
      try {
        const reframeApiEndpoint = "fal-ai/ideogram/v3/reframe";
        const reframeRequest = {
          input: {
            image_url: originalImageUrl,
            image_size: aspectRatio as "portrait_16_9" | "landscape_16_9" | "square" | "portrait_4_3" | "landscape_4_3" | "square_hd"
          }
        };
        
        const reframeResult = await fal.run(reframeApiEndpoint, reframeRequest) as ReframeResult;
        
        // Extract reframed image URL
        const reframedUrl = reframeResult.data?.images?.[0]?.url || reframeResult.images?.[0]?.url;
        
        if (reframedUrl) {
          finalImageUrl = reframedUrl;
        }
      } catch (reframeError) {
        console.error('Character image reframing error (non-fatal):', reframeError);
        // Continue with original image if reframing fails
      }
    }

    return NextResponse.json({
      image_url: finalImageUrl,
      original_image_url: reframe ? originalImageUrl : undefined,
      prompt_used: styledPrompt,
      aspect_ratio: reframe ? aspectRatio : 'original',
      used_reference: !!uploadedImageUrl
    });

  } catch (error) {
    console.error('Character image generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate character image' },
      { status: 500 }
    );
  }
}