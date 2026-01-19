// ============================================================================
// NEW 5-PROMPT SYSTEM TYPES
// ============================================================================

export interface CoreQuestion {
  question: string;
  topic: string;
  context: string;
  book: string;
  generated_at: Date;
}

export interface CorePrinciple {
  name: string;
  description: string;
}

export interface CorePrinciples {
  book: string;
  principles: CorePrinciple[];
  generated_at: Date;
}

export interface AugmentedResearchFinding {
  title: string;
  description: string;
}

export interface AugmentedResearch {
  findings_by_principle: {
    principle_name: string;
    findings: AugmentedResearchFinding[];
  }[];
  raw_perplexity_results: string;
  generated_at: Date;
}

export interface ScriptModule {
  principle_name: string;
  level_1_principle: string;
  level_2_strategy: string;
  level_3_actionable_steps: string[];
  level_4_reflection_question: string;
}

export interface ScriptOutline {
  modules: ScriptModule[];
  core_question: string;
  generated_at: Date;
}

export interface FinalScript {
  content: string;
  word_count: number;
  target_word_count: number;
  book: string;
  core_question: string;
  generated_at: Date;
}

// ============================================================================
// OLD SYSTEM TYPES (kept for post-scripting features)
// ============================================================================

export interface ResearchSource {
  title: string;
  url: string;
  excerpt: string;
}

export interface ResearchData {
  query: string;
  key_insights: string[];
  concrete_examples: string[];
  recommended_angle: string;
  author_match?: {
    name: string;
    work: string;
    concept: string;
    credibility_score: number;
  };
  sources: ResearchSource[];
  raw_research: string;
  generated_at: Date;
}

export interface Topic {
  id: string;
  youtube_title: string;
  viewer_context: string;
  pain_point: string;
  catalyst: string;
  central_question: string;
  emotional_core: string;
  author_info?: {
    name: string;
    work: string;
    concept: string;
  };
  research_data?: ResearchData;
}

export interface OutlineSection {
  section_number: string;
  title: string;
  narrative_purpose?: string; // The structural role this section plays in the narrative
  summary: string;
  emotional_beat: string;
  core_visual_idea?: string;
  section_hook?: string;
  estimated_words: number;
}

export interface OutlineAct {
  act_number: number;
  sections: OutlineSection[];
}

export interface Outline {
  acts: OutlineAct[];
}

export interface ThematicOverlap {
  paragraph_numbers: number[];
  shared_theme: string;
}

export interface MetaphorOveruse {
  metaphor: string;
  paragraph_numbers: number[];
}

export interface ExampleRepetition {
  example: string;
  paragraph_numbers: number[];
}

export interface ConsolidationInstruction {
  action: string;
  source_paragraphs: number[];
  target_location: string;
  new_content_focus: string;
}

export interface RepetitionAnalysisReport {
  thematic_overlaps: ThematicOverlap[];
  metaphor_overuse: MetaphorOveruse[];
  example_repetition: ExampleRepetition[];
  consolidation_plan: ConsolidationInstruction[];
}

export interface DoctorReport {
  overall_diagnosis: string;
  major_changes: string[];
  original_word_count: number;
  final_word_count: number;
  target_word_count?: number;
  target_duration?: number;
  polish_attempts?: number;
}

export interface Script {
  content: string;
  word_count: number;
  target_duration: number;
  generated_at: Date;
  version?: number;
  is_draft?: boolean;
  polished_content?: string;
  polished_word_count?: number;
  doctors_report?: DoctorReport;
  improvement_history?: {
    version: number;
    content: string;
    improvements_applied: string[];
    timestamp: Date;
  }[];
}

export interface Character {
  id: string;
  name: string;
  description: string;
  reference_image_url?: string;
  reference_prompt?: string;
  is_approved: boolean;
}

export interface Scene {
  scene_number: number;
  script_snippet: string;
  visual_prompt: string;
  characters?: string[];
  // Cynical Pop additions
  layout_type?: 'split' | 'overlay' | 'ui' | 'diagram' | 'character' | 'object';
  external_asset_suggestion?: string;
}

// ============================================================================
// STYLE GUIDE TYPES (Stage 1 - Visual Style & Character Intelligence)
// ============================================================================

export interface CharacterManifest {
  id: string;
  name: string;
  visual_description: string;       // e.g., "male stick figure, messy spiky hair, peach skin #FFDBAC"
  personality_traits: string[];     // For expression guidance
  signature_pose?: string;          // Optional default pose
}

export interface ColorPalette {
  success_color: string;            // Hex for positive moments
  failure_color: string;            // Hex for negative moments
  neutral_colors: string[];         // Background/standard colors
  usage_guidance: string;           // When to use which colors
}

export interface StyleGuide {
  global_visual_style: string;      // e.g., "Cynical, high-energy whiteboard sketch"
  character_manifest: CharacterManifest[];
  color_palette: ColorPalette;
  generated_at: Date;
}

// ============================================================================
// DEPRECATED: Old Narrative Context Types (kept for backwards compatibility)
// ============================================================================

/** @deprecated Use StyleGuide instead */
export interface SceneBrief {
  scene_number: number;
  focal_element: string;
  emotional_beat: string;
  visual_tone: 'triumphant' | 'defeated' | 'neutral' | 'chaotic' | 'calm';
  narrative_role: string;
  connects_to?: number[];
  layout_type: 'split' | 'overlay' | 'ui' | 'diagram' | 'character' | 'object';
  overlay_suggestion?: string;
}

/** @deprecated Use StyleGuide instead */
export interface NarrativeContext {
  story_arc: string;
  key_themes: string[];
  emotional_progression: string[];
  scene_briefs: SceneBrief[];
  generated_at: Date;
}

export interface StoryboardScene extends Scene {
  image_url?: string;
  generation_status: 'pending' | 'generating' | 'completed' | 'error';
  error_message?: string;
  is_regenerating?: boolean;
}

export interface AssetApproval {
  phase: 'analyzing' | 'characters' | 'generating' | 'reviewing';
  characters_approved: boolean;
  all_approved: boolean;
}

export type WorkflowStep = 1 | 2 | 3 | 4;

export interface SessionStore {
  // Current workflow step (1-4)
  currentStep: WorkflowStep;
  completedSteps: number[];

  // User preferences
  targetVideoDuration: number; // in minutes

  // Generated content (all in-memory, session only)
  topics: Topic[];
  selectedTopic: Topic | null;
  outline: Outline | null;
  script: Script | null;
  scenes: Scene[];
  storyboardScenes: StoryboardScene[];
  characters: Character[];
  assetApproval: AssetApproval;

  // User-provided content
  customContext?: string; // User's detailed outline/structure

  // Workflow state
  isGenerating: boolean;
  errors: string[];
  sceneGenerationProgress: number;

  // Actions
  setTargetVideoDuration: (duration: number) => void;
  selectTopic: (topic: Topic) => void;
  setResearchData: (researchData: ResearchData) => void;
  setOutline: (outline: Outline) => void;
  setScript: (script: Script) => void;
  setScenes: (scenes: Scene[]) => void;
  setStoryboardScenes: (scenes: StoryboardScene[]) => void;
  updateStoryboardScene: (sceneNumber: number, updates: Partial<StoryboardScene>) => void;
  setCharacters: (characters: Character[]) => void;
  updateCharacter: (id: string, updates: Partial<Character>) => void;
  setAssetApproval: (approval: Partial<AssetApproval>) => void;
  setStep: (step: WorkflowStep) => void;
  setGenerating: (isGenerating: boolean) => void;
  setSceneGenerationProgress: (progress: number) => void;
  addError: (error: string) => void;
  clearErrors: () => void;
  reset: () => void;
  skipToStep: (step: WorkflowStep, mockData: Partial<SessionStore>) => void;
  restoreProgress: (data: Partial<SessionStore>) => void;
  setCustomContext: (context: string | undefined) => void;
}