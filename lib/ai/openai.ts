import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

export function getOpenAIClient() {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured in environment variables');
    }
    
    openaiClient = new OpenAI({
      apiKey,
    });
  }
  
  return openaiClient;
}

export async function generateWithOpenAI(
  prompt: string,
  systemPrompt?: string,
  temperature: number = 0.7
) {
  const client = getOpenAIClient();
  
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  
  messages.push({ role: 'user', content: prompt });
  
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages,
      temperature,
      response_format: { type: 'json_object' },
    });
    
    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error('Failed to generate content with OpenAI');
  }
}

export async function generateTextWithOpenAI(
  prompt: string,
  systemPrompt?: string,
  temperature: number = 0.7,
  maxTokens?: number
) {
  const client = getOpenAIClient();

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  messages.push({ role: 'user', content: prompt });

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages,
      temperature,
      ...(maxTokens && { max_tokens: maxTokens }),
    });

    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error('Failed to generate content with OpenAI');
  }
}