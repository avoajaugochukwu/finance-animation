export function countWords(text: string): number {
  // Remove extra whitespace and split by spaces
  const words = text
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(word => word.length > 0);
  
  return words.length;
}

export function estimateReadingTime(wordCount: number): number {
  // Average reading speed is 150 words per minute for narration
  const wordsPerMinute = 150;
  return Math.ceil(wordCount / wordsPerMinute);
}