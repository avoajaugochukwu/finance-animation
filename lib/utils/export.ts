import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  Topic,
  Outline,
  Script,
  Scene,
  Character,
  StoryboardScene,
  WorkflowStep
} from '../types';
import { SCENE_DURATION_SECONDS } from '../config/development';

interface ExportData {
  topic: Topic | null;
  outline: Outline | null;
  script: Script | null;
  scenes: Scene[];
  characters: Character[];
  storyboardScenes: StoryboardScene[];
  currentStep?: WorkflowStep;
  completedSteps?: number[];
}

// Helper function to pad numbers with zeros
function padNumber(num: number, digits: number = 3): string {
  return String(num).padStart(digits, '0');
}

// Helper function to extract file extension from URL
function getFileExtension(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return match ? match[1] : 'jpg'; // Default to jpg if no extension found
  } catch {
    return 'jpg';
  }
}

// Helper function to fetch media file from URL
async function fetchMediaFile(url: string): Promise<Blob | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}`);
    return await response.blob();
  } catch (error) {
    console.error(`Error fetching media from ${url}:`, error);
    return null;
  }
}

// Create FFmpeg manifest for video assembly
function createFFmpegManifest(data: ExportData): string {
  let manifest = '# FFmpeg Assembly Manifest\n';
  manifest += '# Generated on ' + new Date().toISOString() + '\n\n';

  // Video assembly command example
  manifest += '## Example FFmpeg Commands\n\n';

  // Image sequence to video
  manifest += `### Create video from image sequence (${SCENE_DURATION_SECONDS} seconds per scene):\n`;
  manifest += '```bash\n';
  manifest += `ffmpeg -framerate 1/${SCENE_DURATION_SECONDS} -i media/scenes/scene_%03d.jpg -c:v libx264 -pix_fmt yuv420p scenes_video.mp4\n`;
  manifest += '```\n\n';

  // Add audio instructions
  manifest += '### Add audio to video:\n';
  manifest += '```bash\n';
  manifest += 'ffmpeg -i scenes_video.mp4 -i your_audio.mp3 -c:v copy -c:a aac final_video.mp4\n';
  manifest += '```\n\n';

  // Scene timing information
  manifest += '## Scene Timing Information:\n';
  data.storyboardScenes.forEach((scene, index) => {
    manifest += `Scene ${padNumber(index + 1)}: ${scene.script_snippet?.substring(0, 50)}...\n`;
  });

  return manifest;
}

// Create assembly guide markdown
function createAssemblyGuide(data: ExportData): string {
  let guide = '# Video Assembly Guide\n\n';
  guide += `## Project: ${data.topic?.youtube_title || 'Untitled Story'}\n`;
  guide += `Generated on: ${new Date().toLocaleString()}\n\n`;

  guide += '## File Structure\n\n';
  guide += '```\n';
  guide += 'media/\n';
  guide += '├── characters/     # Character reference images\n';
  guide += '└── scenes/         # Sequential scene images\n';
  guide += '```\n\n';

  guide += '## Assets Summary\n\n';
  guide += `- **Characters**: ${data.characters.filter(c => c.reference_image_url).length} images\n`;
  guide += `- **Scenes**: ${data.storyboardScenes.filter(s => s.image_url).length} images (${SCENE_DURATION_SECONDS} seconds each)\n`;
  guide += `- **Scene Pacing**: ${SCENE_DURATION_SECONDS} seconds per scene\n\n`;

  guide += '## Assembly Steps\n\n';
  guide += '1. **Review Assets**: Check all media files are present\n';
  guide += '2. **Add Audio**: Generate or add your own narration audio\n';
  guide += '3. **Create Video from Scenes**: Use scene images to create video track\n';
  guide += '4. **Combine Tracks**: Merge video and audio into final output\n';
  guide += '5. **Add Transitions**: Optional - add fade effects between scenes\n\n';

  guide += '## Scene Breakdown\n\n';
  data.storyboardScenes.forEach((scene, index) => {
    guide += `### Scene ${padNumber(index + 1)}\n`;
    guide += `- **File**: scene_${padNumber(index + 1)}.${scene.image_url ? getFileExtension(scene.image_url) : 'jpg'}\n`;
    guide += `- **Script**: ${scene.script_snippet?.substring(0, 100)}...\n`;
    guide += `- **Characters**: ${scene.characters?.join(', ') || 'None'}\n\n`;
  });

  return guide;
}

// Create scene timeline JSON for advanced editing
function createSceneTimeline(data: ExportData): object {
  const timeline = {
    project: data.topic?.youtube_title || 'Untitled',
    total_scenes: data.storyboardScenes.length,
    scenes: data.storyboardScenes.map((scene, index) => ({
      scene_number: index + 1,
      filename: `scene_${padNumber(index + 1)}.jpg`,
      script_excerpt: scene.script_snippet?.substring(0, 100),
      characters: scene.characters || [],
      suggested_duration_seconds: SCENE_DURATION_SECONDS,
    }))
  };

  return timeline;
}

export async function createExportZip(data: ExportData): Promise<void> {
  const zip = new JSZip();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const projectName = data.topic?.youtube_title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'story';
  
  // Create media folders
  const mediaFolder = zip.folder('media');
  const charactersFolder = mediaFolder?.folder('characters');
  const scenesFolder = mediaFolder?.folder('scenes');
  const productionFolder = zip.folder('production');
  
  // Download and add character images with sequential naming
  if (charactersFolder && data.characters.length > 0) {
    let charIndex = 1;
    for (const character of data.characters) {
      if (character.reference_image_url) {
        const blob = await fetchMediaFile(character.reference_image_url);
        if (blob) {
          const ext = getFileExtension(character.reference_image_url);
          const filename = `character_${padNumber(charIndex)}.${ext}`;
          charactersFolder.file(filename, blob);
          charIndex++;
        }
      }
    }
    
    // Add character metadata
    charactersFolder.file('characters_metadata.json', JSON.stringify(
      data.characters.map((char, idx) => ({
        filename: `character_${padNumber(idx + 1)}.jpg`,
        name: char.name,
        description: char.description,
        id: char.id
      })), null, 2
    ));
  }

  // Download and add scene images with sequential naming (following script order)
  if (scenesFolder && data.storyboardScenes.length > 0) {
    for (let i = 0; i < data.storyboardScenes.length; i++) {
      const scene = data.storyboardScenes[i];
      if (scene.image_url) {
        const blob = await fetchMediaFile(scene.image_url);
        if (blob) {
          const ext = getFileExtension(scene.image_url);
          const filename = `scene_${padNumber(i + 1)}.${ext}`;
          scenesFolder.file(filename, blob);
        }
      }
    }
    
    // Add scenes metadata
    scenesFolder.file('scenes_metadata.json', JSON.stringify(
      data.storyboardScenes.map((scene, idx) => ({
        filename: `scene_${padNumber(idx + 1)}.jpg`,
        scene_number: scene.scene_number,
        script_snippet: scene.script_snippet,
        visual_prompt: scene.visual_prompt,
        characters: scene.characters
      })), null, 2
    ));
  }

  // Add production files
  if (productionFolder) {
    productionFolder.file('ffmpeg_manifest.txt', createFFmpegManifest(data));
    productionFolder.file('assembly_guide.md', createAssemblyGuide(data));
    productionFolder.file('scene_timeline.json', JSON.stringify(createSceneTimeline(data), null, 2));
  }
  
  // Add main metadata file
  const metadata = {
    exportedAt: new Date().toISOString(),
    projectName,
    title: data.topic?.youtube_title,
    wordCount: data.script?.word_count,
    currentStep: data.currentStep,
    completedSteps: data.completedSteps || [],
    assetCounts: {
      characters: data.characters.filter(c => c.reference_image_url).length,
      scenes: data.storyboardScenes.filter(s => s.image_url).length
    }
  };
  zip.file('metadata.json', JSON.stringify(metadata, null, 2));
  
  // Add script
  if (data.script) {
    zip.file('script.txt', data.script.content);
    zip.file('script.md', `# ${data.topic?.youtube_title || 'Story'}\n\n${data.script.content}`);
  }
  
  // Add outline
  if (data.outline) {
    let outlineText = 'STORY OUTLINE\n' + '='.repeat(50) + '\n\n';
    data.outline.acts.forEach(act => {
      outlineText += `\nACT ${act.act_number}\n` + '-'.repeat(30) + '\n\n';
      act.sections.forEach(section => {
        outlineText += `${section.section_number}. ${section.title}\n`;
        outlineText += `   ${section.summary}\n`;
        outlineText += `   Emotional Beat: ${section.emotional_beat}\n`;
        outlineText += `   Estimated Words: ${section.estimated_words}\n\n`;
      });
    });
    zip.file('outline.txt', outlineText);
  }
  
  // Generate and download the zip file
  const blob = await zip.generateAsync({ 
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
  saveAs(blob, `${projectName}_${timestamp}.zip`);
}

// Create a progress snapshot for import/resume
export async function createProgressSnapshot(data: ExportData): Promise<void> {
  const zip = new JSZip();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const projectName = data.topic?.youtube_title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'progress';

  // Create media folders
  const mediaFolder = zip.folder('media');
  const charactersFolder = mediaFolder?.folder('characters');
  const scenesFolder = mediaFolder?.folder('scenes');

  // Download and add character images with sequential naming
  if (charactersFolder && data.characters.length > 0) {
    let charIndex = 1;
    for (const character of data.characters) {
      if (character.reference_image_url) {
        const blob = await fetchMediaFile(character.reference_image_url);
        if (blob) {
          const ext = getFileExtension(character.reference_image_url);
          const filename = `character_${padNumber(charIndex)}.${ext}`;
          charactersFolder.file(filename, blob);
          charIndex++;
        }
      }
    }

    // Add character metadata
    charactersFolder.file('characters_metadata.json', JSON.stringify(
      data.characters.map((char, idx) => ({
        filename: `character_${padNumber(idx + 1)}.jpg`,
        name: char.name,
        description: char.description,
        id: char.id
      })), null, 2
    ));
  }

  // Download and add scene images with sequential naming (following script order)
  if (scenesFolder && data.storyboardScenes.length > 0) {
    for (let i = 0; i < data.storyboardScenes.length; i++) {
      const scene = data.storyboardScenes[i];
      if (scene.image_url) {
        const blob = await fetchMediaFile(scene.image_url);
        if (blob) {
          const ext = getFileExtension(scene.image_url);
          const filename = `scene_${padNumber(i + 1)}.${ext}`;
          scenesFolder.file(filename, blob);
        }
      }
    }

    // Add scenes metadata
    scenesFolder.file('scenes_metadata.json', JSON.stringify(
      data.storyboardScenes.map((scene, idx) => ({
        filename: `scene_${padNumber(idx + 1)}.jpg`,
        scene_number: scene.scene_number,
        script_snippet: scene.script_snippet,
        visual_prompt: scene.visual_prompt,
        characters: scene.characters
      })), null, 2
    ));
  }

  // Create progress data file with all session state
  const progressData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    currentStep: data.currentStep,
    completedSteps: data.completedSteps || [],

    // Session data
    topic: data.topic,
    outline: data.outline,
    script: data.script,
    scenes: data.scenes,
    characters: data.characters,
    storyboardScenes: data.storyboardScenes,
  };

  zip.file('progress.json', JSON.stringify(progressData, null, 2));

  // Add a README explaining how to resume
  const readme = `# Progress Snapshot

This is a progress snapshot from Casual Explainer Studio.

**Exported:** ${new Date().toLocaleString()}
**Current Step:** ${data.currentStep} of 4
**Project:** ${data.topic?.youtube_title || 'Untitled'}

## How to Resume

1. Open Casual Explainer Studio
2. Click "Resume from File" on the start screen
3. Upload this ZIP file
4. Your progress will be restored and you'll continue from step ${data.currentStep}

## What's Included

- Story topic and metadata
${data.outline ? '- Story outline' : ''}
${data.script ? '- Generated script' : ''}
${data.characters.length > 0 ? `- ${data.characters.length} character(s) with images` : ''}
${data.storyboardScenes.length > 0 ? `- ${data.storyboardScenes.length} scene(s) with images` : ''}

## Media Files

All generated media files are included in the \`media/\` folder:
- \`media/characters/\` - Character reference images
- \`media/scenes/\` - Storyboard scene images

Everything you need to resume your project or assemble the final video is included!
`;

  zip.file('README.md', readme);

  // Generate and download the zip file
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });
  saveAs(blob, `${projectName}_progress_${timestamp}.zip`);
}

// Import and restore progress from a snapshot
export async function importProgressSnapshot(file: File): Promise<ExportData | null> {
  try {
    const zip = await JSZip.loadAsync(file);
    const progressFile = zip.file('progress.json');

    if (!progressFile) {
      throw new Error('Invalid progress file - progress.json not found');
    }

    const progressContent = await progressFile.async('string');
    const progressData = JSON.parse(progressContent);

    // Validate version
    if (!progressData.version || progressData.version !== '1.0') {
      throw new Error('Unsupported progress file version');
    }

    // Validate and coerce currentStep to proper type
    let currentStep: WorkflowStep = 1;
    if (progressData.currentStep && progressData.currentStep >= 1 && progressData.currentStep <= 4) {
      currentStep = progressData.currentStep as WorkflowStep;
    }

    // Return the parsed data
    return {
      topic: progressData.topic || null,
      outline: progressData.outline || null,
      script: progressData.script || null,
      scenes: progressData.scenes || [],
      characters: progressData.characters || [],
      storyboardScenes: progressData.storyboardScenes || [],
      currentStep,
      completedSteps: progressData.completedSteps || [],
    };
  } catch (error) {
    console.error('Error importing progress:', error);
    throw error;
  }
}

export function estimateZipSize(data: ExportData): string {
  let sizeInBytes = 0;

  // Estimate media file sizes (rough estimates)
  const characterImages = data.characters.filter(c => c.reference_image_url).length;
  const sceneImages = data.storyboardScenes.filter(s => s.image_url).length;

  // Images: ~500KB each
  sizeInBytes += (characterImages + sceneImages) * 500 * 1024;

  // Text files
  if (data.script) {
    sizeInBytes += data.script.content.length * 2;
  }
  
  // Add metadata and other files (~100KB)
  sizeInBytes += 100 * 1024;
  
  // Format size
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} bytes`;
  } else if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}