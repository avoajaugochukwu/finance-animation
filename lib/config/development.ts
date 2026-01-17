import { Topic, Outline, Script, Character, Scene } from "@/lib/types";

// Development mode flag
export const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

// Scene duration for video production (in seconds)
export const SCENE_DURATION_SECONDS = 4; // Faster cuts for cynical pacing

// Mock data generators
export const mockTopic: Topic = {
  id: "mock-topic-money-1",
  youtube_title:
    "Why Your Brain Treats Money Like a Leaky Bucket (And How to Fix It)",
  viewer_context:
    "People with steady income who struggle to save money",
  pain_point:
    "Earning decent money but watching it disappear with nothing to show for it",
  catalyst:
    'Discovering the psychological "leaks" that drain savings without awareness',
  central_question: "How can you plug the invisible money leaks in your brain?",
  emotional_core: "Awareness, Control, Financial Freedom",
};

export const mockOutline: Outline = {
  acts: [
    {
      act_number: 1,
      sections: [
        {
          section_number: "1.1",
          title: "The Disappearing Money",
          summary:
            "A stick figure looks at their empty bank account on a phone, completely bewildered as to where the money went.",
          emotional_beat: "Frustration & Confusion",
          core_visual_idea:
            "A stick figure holding an empty wallet upside down, with only a single moth flying out.",
          estimated_words: 180,
        },
        {
          section_number: "1.2",
          title: "The Micro-Leaks",
          summary:
            "The problem is identified not as large purchases, but as a series of small, unnoticeable expenses that add up.",
          emotional_beat: "Recognition & Awareness",
          core_visual_idea:
            "A close-up on a stick figure's pocket with tiny holes, where small coins are falling out unnoticed.",
          estimated_words: 200,
        },
        {
          section_number: "1.3",
          title: "The Three-Step Fix",
          summary:
            "Introduction of the solution: three simple principles to stop the financial leaks.",
          emotional_beat: "Hope & Empowerment",
          core_visual_idea:
            "Three simple icons in a row: a magnifying glass (Awareness), a robot arm (Automation), and two stick figures shaking hands (Accountability).",
          estimated_words: 220,
        },
        {
          section_number: "1.4",
          title: "Putting it to Practice",
          summary:
            "A breakdown of how to apply each of the three principles in a practical way.",
          emotional_beat: "Clarity & Action",
          core_visual_idea:
            "A stick figure placing large patches over the holes in their pocket, looking determined.",
          estimated_words: 200,
        },
        {
          section_number: "1.5",
          title: "Financial Health",
          summary:
            "The result: the stick figure now has a growing savings account and a sense of control.",
          emotional_beat: "Achievement & Freedom",
          core_visual_idea:
            "A happy stick figure watering a small plant that has a dollar sign leaf, watching it grow.",
          estimated_words: 150,
        },
      ],
    },
  ],
};

export const mockScript: Script = {
  content: `You check your bank account and it's a ghost town. You got paid just last week, but the balance is shockingly low. You didn't buy anything big, so where did it all go? It feels like your money just vanished into thin air.

Here's the secret: your wealth isn't being stolen by a thief, it's escaping through a thousand tiny holes. It's the five bucks for coffee, the ten for a subscription you forgot, the quick online purchase. These are the micro-leaks. Individually, they're nothing. But together, they drain your account dry without you even noticing.

But you can fix this. You don't need to earn more, you just need to plug the leaks. There's a simple three-step fix. First, Awareness: see where the money is going. Second, Automation: save your money before you have a chance to spend it. And third, Accountability: get a friend to keep you on track.

It starts by putting patches on those tiny holes. You track your spending, and suddenly the invisible leaks become visible. You set up an automatic transfer to your savings, building a wall against impulse buys. You tell a friend your goal, and now you have a reason not to slip up.

Slowly, things change. You see your savings account start to grow. That little money plant starts to sprout new leaves. You're not just surviving anymore, you're building financial security. And that feeling of control? That's what true financial freedom feels like.`,
  word_count: 275,
  target_duration: 2,
  generated_at: new Date(),
  version: 1,
};

export const mockCharacters: Character[] = [
  {
    id: "character_1",
    name: "Main Character",
    description: "male", // Simple description - API will handle the styling
    is_approved: false,
  },
  {
    id: "character_2",
    name: "Friend",
    description: "female",
    is_approved: false,
  },
  {
    id: "character_3",
    name: "Money Plant",
    description: "potted plant with dollar sign leaves",
    is_approved: false,
  },
];

export const mockScenes: Scene[] = [
  {
    scene_number: 1,
    script_snippet:
      "You check your bank account and bro, where did it all go? Your account looks sadder than a deflated birthday balloon.",
    visual_prompt:
      "A sad, deflated wallet with a worried face lying flat on a surface. Dollar bills with tiny wings are flying away from small holes in the wallet. The background is a soft purple gradient.",
    characters: ["character_2"],
  },
  {
    scene_number: 2,
    script_snippet:
      "Your brain treats money like a leaky bucket. It's got these tiny, invisible holes drilled all over it.",
    visual_prompt:
      'A simple bucket with multiple small holes. Dollar bills are pouring out of the holes, each labeled with tiny text like "coffee," "apps," "snacks," on a clean white background.',
    characters: [],
  },
  {
    scene_number: 3,
    script_snippet:
      "The wild part? You don't need to earn more money. You need to plug the leaks.",
    visual_prompt:
      'Jordan having an "aha moment" with a lightbulb literally glowing above their head. Their eyes are wide with realization. Three glowing plugs float around them. The background is a bright yellow with simple radiating lines.',
    characters: ["character_1"],
  },
  {
    scene_number: 4,
    script_snippet:
      "There are only three plugs you need: Awareness, Automation, and Accountability.",
    visual_prompt:
      "A clean three-panel split screen layout. Panel 1: A magnifying glass examining dollar bills. Panel 2: A robot arm moving coins into a piggy bank. Panel 3: Two hands doing a pinky promise, on a clean white background.",
    characters: [],
  },
  {
    scene_number: 5,
    script_snippet:
      "Your bucket starts filling up. You're building something. That's what financial freedom feels like.",
    visual_prompt:
      "A cheerful money bag with a smiling face and a happy wallet with a relieved expression are high-fiving each other. Golden coins and bills are floating around them in celebration. The background is a bright green with confetti shapes.",
    characters: ["character_2", "character_3"],
  },
];

// Helper function to generate mock data for any step
export const getMockDataForStep = (step: number) => {
  switch (step) {
    case 1: // Topics
      return { topics: [mockTopic] };
    case 2: // Outline
      return { selectedTopic: mockTopic, outline: mockOutline };
    case 3: // Draft Script
      return {
        selectedTopic: mockTopic,
        outline: mockOutline,
        script: { ...mockScript, is_draft: true },
        targetVideoDuration: mockScript.target_duration,
      };
    case 4: // Polish
      return {
        selectedTopic: mockTopic,
        outline: mockOutline,
        script: {
          ...mockScript,
          is_draft: false,
          polished_content: mockScript.content,
          polished_word_count: mockScript.word_count,
        },
        targetVideoDuration: mockScript.target_duration,
      };
    case 5: // Scenes
      return {
        selectedTopic: mockTopic,
        outline: mockOutline,
        script: {
          ...mockScript,
          is_draft: false,
          polished_content: mockScript.content,
          polished_word_count: mockScript.word_count,
        },
        scenes: mockScenes,
        characters: mockCharacters,
        assetApproval: {
          phase: "analyzing" as const,
          characters_approved: false,
          all_approved: false,
        },
        targetVideoDuration: mockScript.target_duration,
      };
    case 6: // Audio
    case 7: // Export
      return {
        selectedTopic: mockTopic,
        outline: mockOutline,
        script: {
          ...mockScript,
          is_draft: false,
          polished_content: mockScript.content,
          polished_word_count: mockScript.word_count,
        },
        scenes: mockScenes,
        characters: mockCharacters,
        targetVideoDuration: mockScript.target_duration,
      };
    default:
      return {};
  }
};
