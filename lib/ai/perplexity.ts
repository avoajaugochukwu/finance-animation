import { ResearchData } from '@/lib/types';

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

interface PerplexityUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  search_context_size?: number;
  citation_tokens?: number;
  num_search_queries?: number;
  reasoning_tokens?: number;
}

interface PerplexitySearchResult {
  title: string;
  url: string;
  date?: string;
}

interface PerplexityResponse {
  id?: string;
  model?: string;
  created?: number;
  object?: string;
  choices: Array<{
    index?: number;
    finish_reason?: 'stop' | 'length';
    message: {
      role?: string;
      content: string;
    };
  }>;
  usage?: PerplexityUsage;
  citations?: string[];
  search_results?: PerplexitySearchResult[];
}

/**
 * Research a topic using Perplexity AI's web search capabilities
 * @param title - The video title or topic to research
 * @param hasAuthor - Whether an author/book was detected in the title
 * @returns Structured research data with citations and insights
 */
export async function researchTopic(
  title: string,
  hasAuthor: boolean = false
): Promise<ResearchData> {
  if (!PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY is not configured');
  }

  const searchQuery = buildResearchQuery(title, hasAuthor);

  console.log(`[Perplexity] Initiating API Request`);
  console.log(`[Perplexity] Parameters: Model=sonar-pro, Temp=0.2, MaxTokens=4000, Recency=month`);
  console.log('[Perplexity] ===== RESEARCH QUERY =====');
  console.log(searchQuery);
  console.log('[Perplexity] ============================');
  const startTime = Date.now();

  try {
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
            content: 'You are a research assistant helping gather factual, specific information for video script writing. Focus on concrete examples, real-world applications, and specific claims backed by sources. Avoid vague philosophical overviews.'
          },
          {
            role: 'user',
            content: searchQuery
          }
        ],
        temperature: 0.2,
        max_tokens: 4000,
        return_citations: true,
        search_recency_filter: 'month'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
    }

    const data: PerplexityResponse = await response.json();
    const researchContent = data.choices[0]?.message?.content;

    const duration = Date.now() - startTime;
    console.log(`[Perplexity] API Response Received - Status: ${response.status}, Duration: ${duration}ms`);
    console.log(`[Perplexity] Response Data: Citations=${data.citations?.length || 0}, ContentLength=${researchContent?.length || 0} chars`);

    // Log raw research content
    console.log('[Perplexity] ===== RAW RESEARCH RESPONSE =====');
    console.log(researchContent || '[NO CONTENT]');
    console.log('[Perplexity] ===================================');

    // Log individual citations
    if (data.citations && data.citations.length > 0) {
      console.log('[Perplexity] Citations:');
      data.citations.forEach((url, i) => console.log(`  [${i + 1}] ${url}`));
    }

    // Log usage statistics (if available)
    if (data.usage) {
      console.log('[Perplexity] Usage Stats:', {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens,
        num_search_queries: data.usage.num_search_queries || 'N/A',
      });
    }

    // Log search results (if available)
    if (data.search_results && data.search_results.length > 0) {
      console.log('[Perplexity] Search Results:');
      data.search_results.forEach((result, i) =>
        console.log(`  [${i + 1}] ${result.title} - ${result.url}`)
      );
    }

    if (!researchContent) {
      throw new Error('No content returned from Perplexity API');
    }

    // Parse the structured research response
    const researchData = parseResearchResponse(researchContent, data.citations || []);

    console.log(`[Perplexity] Research Data Parsed Successfully`);
    console.log(`[Perplexity] Extracted: KeyInsights=${researchData.key_insights.length}, Examples=${researchData.concrete_examples.length}, Sources=${researchData.sources.length}`);

    // Log key insights individually
    if (researchData.key_insights.length > 0) {
      console.log('[Perplexity] Key Insights:');
      researchData.key_insights.forEach((insight, i) =>
        console.log(`  ${i + 1}. ${insight}`)
      );
    }

    // Log concrete examples
    if (researchData.concrete_examples.length > 0) {
      console.log('[Perplexity] Concrete Examples:');
      researchData.concrete_examples.forEach((ex, i) =>
        console.log(`  ${i + 1}. ${ex}`)
      );
    }

    // Log recommended angle
    if (researchData.recommended_angle) {
      console.log('[Perplexity] Recommended Angle:', researchData.recommended_angle);
    }

    // Log author match if present
    if (researchData.author_match) {
      console.log('[Perplexity] Author Match:', {
        name: researchData.author_match.name,
        work: researchData.author_match.work,
        concept: researchData.author_match.concept,
      });
    }

    return researchData;
  } catch (error) {
    console.error(`[Perplexity] API Call Failed`);
    console.error(`[Perplexity] Query was: "${title.substring(0, 100)}..."`);
    console.error('[Perplexity] Error details:', error);
    throw error;
  }
}

/**
 * Build comprehensive research query based on whether topic has author/book
 */
function buildResearchQuery(title: string, hasAuthor: boolean): string {
  if (hasAuthor) {
    return `Research this book/topic for a video script: "${title}"

Please provide comprehensive, factual information organized as follows:

1. BOOK/SOURCE VERIFICATION:
   - Confirm the book exists and identify the author
   - Publication date and credibility of the source
   - Main thesis or purpose of the work

2. KEY CONCEPTS AND LESSONS:
   - What are the 3-5 most important concepts from this book?
   - What specific lessons does it teach related to the title?
   - What frameworks, models, or systems does it present?

3. CONCRETE EXAMPLES:
   - What are the most memorable stories or examples from the book?
   - Are there case studies or real-world applications mentioned?
   - What specific data, statistics, or research does it cite?

4. STRONG CLAIMS AND INSIGHTS:
   - What counter-intuitive or surprising claims does the author make?
   - What unique perspective differentiates this from other works?
   - What are the most quotable insights?

5. REAL-WORLD IMPACT:
   - How have people applied these concepts?
   - Are there documented success stories or transformations?
   - What do reviewers and readers highlight as most impactful?

6. BEST ANGLE FOR VIDEO:
   - Based on the title "${title}", what is the most compelling single concept/habit/insight to focus on?
   - What would make viewers think "I need to know this NOW"?
   - What's the clearest path from problem to transformation?

Format your response as a structured JSON object with these keys: book_info, key_concepts, concrete_examples, strong_claims, real_world_impact, recommended_angle, sources.`;
  } else {
    return `Research this topic for a video script: "${title}"

Please provide comprehensive, factual information organized as follows:

1. TOPIC VERIFICATION:
   - What is this topic about?
   - Are there credible sources, experts, or authorities on this subject?
   - Is there a specific book, study, or body of work this relates to?

2. KEY CONCEPTS AND INSIGHTS:
   - What are the 3-5 most important concepts related to this topic?
   - What do experts say about this?
   - What frameworks or models exist for understanding this?

3. CONCRETE EXAMPLES:
   - What are real-world examples of this concept in action?
   - Are there case studies, experiments, or documented instances?
   - What specific data or statistics support this topic?

4. STRONG CLAIMS AND INSIGHTS:
   - What counter-intuitive or surprising facts exist about this topic?
   - What unique perspectives do thought leaders offer?
   - What are the most compelling insights?

5. REAL-WORLD IMPACT:
   - How have people applied this knowledge?
   - Are there success stories or documented transformations?
   - What do people say has been life-changing about this?

6. BEST ANGLE FOR VIDEO:
   - Based on the title "${title}", what is the most compelling angle to focus on?
   - What would make viewers think "I need to know this NOW"?
   - What's the clearest path from problem to transformation?

Format your response as a structured JSON object with these keys: topic_info, key_concepts, concrete_examples, strong_claims, real_world_impact, recommended_angle, sources.`;
  }
}

/**
 * Parse Perplexity's research response into structured data
 */
function parseResearchResponse(content: string, citations: string[]): ResearchData {
  try {
    // Try to parse as JSON first
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      // Extract key insights from various fields
      const keyInsights: string[] = [];

      if (parsed.key_concepts) {
        if (Array.isArray(parsed.key_concepts)) {
          keyInsights.push(...parsed.key_concepts);
        } else if (typeof parsed.key_concepts === 'string') {
          keyInsights.push(parsed.key_concepts);
        }
      }

      if (parsed.strong_claims) {
        if (Array.isArray(parsed.strong_claims)) {
          keyInsights.push(...parsed.strong_claims);
        } else if (typeof parsed.strong_claims === 'string') {
          keyInsights.push(parsed.strong_claims);
        }
      }

      // Build sources array
      const sources = citations.map((url, index) => ({
        title: `Source ${index + 1}`,
        url: url,
        excerpt: ''
      }));

      return {
        query: parsed.topic_info || parsed.book_info || '',
        key_insights: keyInsights,
        concrete_examples: Array.isArray(parsed.concrete_examples)
          ? parsed.concrete_examples
          : [parsed.concrete_examples].filter(Boolean),
        recommended_angle: parsed.recommended_angle || '',
        author_match: parsed.book_info ? {
          name: parsed.book_info.author || '',
          work: parsed.book_info.title || '',
          concept: parsed.book_info.main_thesis || '',
          credibility_score: 0.9
        } : undefined,
        sources,
        raw_research: content,
        generated_at: new Date()
      };
    }

    // Fallback: parse as unstructured text
    return {
      query: 'Research conducted',
      key_insights: extractBulletPoints(content),
      concrete_examples: [],
      recommended_angle: '',
      sources: citations.map((url, index) => ({
        title: `Source ${index + 1}`,
        url,
        excerpt: ''
      })),
      raw_research: content,
      generated_at: new Date()
    };
  } catch (error) {
    console.error('Error parsing research response:', error);

    // Return minimal structure with raw content
    return {
      query: 'Research conducted',
      key_insights: [content.substring(0, 500)],
      concrete_examples: [],
      recommended_angle: '',
      sources: citations.map((url, index) => ({
        title: `Source ${index + 1}`,
        url,
        excerpt: ''
      })),
      raw_research: content,
      generated_at: new Date()
    };
  }
}

/**
 * Extract bullet points from unstructured text
 */
function extractBulletPoints(text: string): string[] {
  const lines = text.split('\n');
  const bulletPoints: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/^[-•*]\s+/) || trimmed.match(/^\d+\.\s+/)) {
      bulletPoints.push(trimmed.replace(/^[-•*]\s+/, '').replace(/^\d+\.\s+/, ''));
    }
  }

  return bulletPoints.length > 0 ? bulletPoints : [text.substring(0, 500)];
}
