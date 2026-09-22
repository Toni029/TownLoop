import { WorkOrderItem } from '../types';

export interface TranslatedContent {
  title: string;
  description: string;
  comments: Record<string | number, string>;
  isSpanish: boolean;
}

// In-memory cache for instant toggling without re-fetching
const translationCache = new Map<string, TranslatedContent>();

/**
 * Translates work order title, description, and comments from English to Spanish
 * using the server-side translation endpoint with in-memory caching.
 */
export async function translateWorkOrder(
  workOrder: WorkOrderItem
): Promise<TranslatedContent> {
  const commentsList = workOrder.comments || [];
  const woKey = JSON.stringify([
    workOrder.id,
    workOrder.title,
    workOrder.description || '',
    commentsList.map(({ id, text }) => [id, text]),
  ]);

  if (translationCache.has(woKey)) {
    return translationCache.get(woKey)!;
  }

  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: workOrder.title,
        description: workOrder.description || '',
        comments: commentsList.map(({ text }) => text),
      }),
    });
    if (!response.ok) throw new Error('Translation request failed.');
    const translated = await response.json();
    const translatedComments = Array.isArray(translated.comments) ? translated.comments : [];

    const commentMap: Record<string | number, string> = {};
    commentsList.forEach((c, index) => {
      commentMap[c.id] = translatedComments[index] || c.text;
    });

    const result: TranslatedContent = {
      title: translated.title || workOrder.title,
      description: translated.description || workOrder.description || '',
      comments: commentMap,
      isSpanish: true,
    };

    translationCache.set(woKey, result);
    return result;
  } catch (error) {
    console.warn('Translation unavailable:', error);
    const commentMap: Record<string | number, string> = {};
    (workOrder.comments || []).forEach((c) => {
      commentMap[c.id] = c.text;
    });

    const fallback: TranslatedContent = {
      title: workOrder.title,
      description: workOrder.description || '',
      comments: commentMap,
      isSpanish: true,
    };

    translationCache.set(woKey, fallback);
    return fallback;
  }
}
