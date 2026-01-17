import { create } from 'zustand';
import { SessionStore, WorkflowStep, AssetApproval } from './types';

const initialAssetApproval: AssetApproval = {
  phase: 'analyzing',
  characters_approved: false,
  all_approved: false,
};

const initialState = {
  currentStep: 1 as WorkflowStep,
  completedSteps: [] as number[],
  targetVideoDuration: 13, // default 13 minutes
  topics: [],
  selectedTopic: null,
  outline: null,
  script: null,
  scenes: [],
  storyboardScenes: [],
  characters: [],
  assetApproval: initialAssetApproval,
  customContext: undefined as string | undefined,
  isGenerating: false,
  errors: [],
  sceneGenerationProgress: 0,
};

export const useSessionStore = create<SessionStore>((set) => ({
  ...initialState,

  setTargetVideoDuration: (duration) => set({ targetVideoDuration: duration }),

  selectTopic: (topic) => set({ selectedTopic: topic }),

  setResearchData: (researchData) => set((state) => ({
    selectedTopic: state.selectedTopic
      ? { ...state.selectedTopic, research_data: researchData }
      : null
  })),

  setCustomContext: (context) => set({ customContext: context }),
  
  setOutline: (outline) => set({ outline }),
  
  setScript: (script) => set({ script }),

  setScenes: (scenes) => set({ scenes }),
  
  setStoryboardScenes: (scenes) => set({ storyboardScenes: scenes }),
  
  updateStoryboardScene: (sceneNumber, updates) => set((state) => ({
    storyboardScenes: state.storyboardScenes.map(scene =>
      scene.scene_number === sceneNumber ? { ...scene, ...updates } : scene
    )
  })),
  
  setCharacters: (characters) => set({ characters }),

  updateCharacter: (id, updates) => set((state) => ({
    characters: state.characters.map(char =>
      char.id === id ? { ...char, ...updates } : char
    )
  })),

  setAssetApproval: (approval) => set((state) => ({
    assetApproval: { ...state.assetApproval, ...approval }
  })),

  setStep: (step) => set({ currentStep: step }),

  setGenerating: (isGenerating) => set({
    isGenerating
  }),
  
  setSceneGenerationProgress: (progress) => set({ sceneGenerationProgress: progress }),
  
  addError: (error) => set((state) => ({ 
    errors: [...state.errors, error] 
  })),
  
  clearErrors: () => set({ errors: [] }),
  
  reset: () => set(initialState),

  // Development helpers
  skipToStep: (step: WorkflowStep, mockData: Partial<SessionStore>) => set((state) => ({
    ...state,
    ...mockData,
    currentStep: step
  })),

  restoreProgress: (data: Partial<SessionStore>) => set((state) => ({
    ...state,
    ...data,
  })),
}));