import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient } from '@/lib/ai/openai';
import { SYSTEM_PROMPT, AUGMENTED_RESEARCH_PROMPT } from '@/lib/prompts/all-prompts';
import { AugmentedResearch } from '@/lib/types';

export const runtime = 'edge';
export const maxDuration = 60;

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

interface AugmentedResearchRequest {
  core_question: string;
  core_principles_text: string; // Formatted markdown text of principles
  topic: string;
  book: string;
}

/**
 * POST /api/research/augmented
 *
 * PROMPT 3: Augmented Research
 * Uses Perplexity to gather practical, modern research
 * Then uses OpenAI to organize findings by principle
 */
export async function POST(request: NextRequest) {
  try {
    const body: AugmentedResearchRequest = await request.json();
    const { core_question, core_principles_text, topic, book } = body;

    // Validation
    if (!core_question || core_question.trim().length === 0) {
      return NextResponse.json(
        { error: 'Core question is required' },
        { status: 400 }
      );
    }

    if (!core_principles_text || core_principles_text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Core principles text is required' },
        { status: 400 }
      );
    }

    if (!topic || !book) {
      return NextResponse.json(
        { error: 'Topic and book are required' },
        { status: 400 }
      );
    }

    console.log(`[Augmented Research] Starting research for: "${topic}"`);

    // Step 1: Conduct Perplexity research
    const perplexityResults = await conductPerplexityResearch(topic, book, core_question);

    console.log(`[Augmented Research] Perplexity research completed`);

    // Step 2: Organize results using OpenAI with the augmented research prompt
    const client = getOpenAIClient();
    const prompt = AUGMENTED_RESEARCH_PROMPT(
      core_question,
      core_principles_text,
      perplexityResults
    );

    const response = await client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const organizedText = response.choices[0]?.message?.content || '';

    console.log(`[Augmented Research] Results organized by OpenAI`);
    console.log(organizedText);

    // Parse the organized findings
    const augmentedResearch: AugmentedResearch = {
      findings_by_principle: parseFindingsByPrinciple(organizedText),
      raw_perplexity_results: perplexityResults,
      generated_at: new Date(),
    };

    return NextResponse.json({
      success: true,
      augmented_research: augmentedResearch,
    });

  } catch (error) {
    console.error('[Augmented Research] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to conduct augmented research',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * Conduct research using Perplexity AI
 */
async function conductPerplexityResearch(
  topic: string,
  book: string,
  coreQuestion: string
): Promise<string> {
  if (!PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY is not configured');
  }

  const searchQuery = `Research practical, modern strategies and tools related to this question:

${coreQuestion}

Context:
- Topic: ${topic}
- Book/Framework: ${book}

Please provide:
1. Modern tools, apps, or technologies that help implement these concepts
2. Current research, studies, or data that support these ideas
3. Specific, actionable strategies (e.g., "automated savings transfers", "zero-based budgeting apps")
4. Real-world applications and examples
5. Contemporary best practices

Focus on PRACTICAL, ACTIONABLE information that someone could use TODAY.`;

  console.log('[Perplexity] Research query:', searchQuery);

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [
        {
          role: 'system',
          content: 'You are a research assistant gathering practical, actionable information about modern strategies and tools.'
        },
        {
          role: 'user',
          content: searchQuery
        }
      ],
      temperature: 0.2,
      max_tokens: 3000,
      return_citations: true,
      search_recency_filter: 'month'
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const researchContent = data.choices[0]?.message?.content;

  if (!researchContent) {
    throw new Error('No content returned from Perplexity API');
  }

  console.log('[Perplexity] Research completed, length:', researchContent.length);

  return researchContent;
}

/**
 * Parse findings organized by principle from the OpenAI response
 * Format:
 * **Supporting Research for: [Principle Name]**
 * - **[Title]:** Description
 */
function parseFindingsByPrinciple(text: string): Array<{
  principle_name: string;
  findings: Array<{ title: string; description: string }>;
}> {
  const results: Array<{
    principle_name: string;
    findings: Array<{ title: string; description: string }>;
  }> = [];

  // Split by principle sections
  const sections = text.split(/\*\*Supporting Research for:\s*([^*]+)\*\*/);

  for (let i = 1; i < sections.length; i += 2) {
    const principleName = sections[i].trim();
    const findingsText = sections[i + 1] || '';

    // Parse findings within this section
    const findings: Array<{ title: string; description: string }> = [];
    const findingRegex = /-\s*\*\*([^:]+):\*\*\s*([^\n]+)/g;

    let match;
    while ((match = findingRegex.exec(findingsText)) !== null) {
      findings.push({
        title: match[1].trim(),
        description: match[2].trim(),
      });
    }

    if (findings.length > 0) {
      results.push({ principle_name: principleName, findings });
    }
  }

  return results;
}
