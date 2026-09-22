/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import { GoogleGenAI, Type } from '@google/genai';

let aiClient: GoogleGenAI | null = null;
const withTimeout = <T>(operation: Promise<T>, timeoutMs = 15_000): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Gemini request timed out.')), timeoutMs);
    operation.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });

function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export interface TranslationPayload {
  title: string;
  description?: string;
  comments?: string[];
  targetLang?: 'es' | 'en';
}

export interface TranslationResult {
  title: string;
  description?: string;
  comments?: string[];
  source: 'gemini' | 'dictionary-fallback';
}

/**
 * Intelligent domain-specific dictionary and pattern replacer for property maintenance and repair
 */
export function fallbackTranslateToSpanish(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let t = text.trim();

  // Common complete phrases mapping
  const commonExactPhrases: Record<string, string> = {
    'AC leaking water in hallway': 'Aire acondicionado goteando agua en el pasillo',
    'Garbage disposal broken': 'Triturador de basura descompuesto',
    'Kitchen sink faucet dripping': 'Grifo del fregadero de la cocina goteando',
    'Water heater not heating': 'El calentador de agua no está calentando',
    'Front door lock jammed': 'Cerradura de la puerta principal atascada',
    'Toilet running constantly': 'El inodoro corre agua constantemente',
    'Toilet constantly running': 'El inodoro corre agua constantemente',
    'Smoke detector beeping': 'Detector de humo pitando (cambio de batería)',
    'Light fixture flickering': 'Lámpara o lámpara de techo parpadeando',
    'Clogged bathroom drain': 'Drenaje del baño tapado / obstruido',
    'Broken window latch': 'Pestillo o seguro de ventana roto',
    'Refrigerator not cooling': 'El refrigerador no está enfriando',
    'Dishwasher leaking soap': 'Lavavajillas goteando agua con jabón',
    'Dryer not spinning': 'La secadora no está girando',
    'Washer overflowing': 'La lavadora se está desbordando',
    'Ceiling fan squeaking': 'El ventilador de techo rechina al girar',
    'Outlet sparking in kitchen': 'Enchufe sacando chispas en la cocina',
    'Door handle loose': 'Manija de la puerta floja',
    'Permission to enter given': 'Permiso otorgado para ingresar a la unidad',
    'Permission to enter': 'Permiso para ingresar',
    'Please fix as soon as possible': 'Por favor reparar lo más pronto posible',
    'Please call before entering': 'Por favor llamar antes de entrar',
    'Dog in bedroom': 'Hay perro en la recámara',
    'Cat inside': 'Gato adentro de la vivienda',
  };

  if (commonExactPhrases[t]) {
    return commonExactPhrases[t];
  }

  // Common replacements
  const replacements: [RegExp, string][] = [
    [/\b(AC|A\/C|air conditioner|air conditioning)\b/gi, 'aire acondicionado'],
    [/\b(water heater)\b/gi, 'calentador de agua'],
    [/\b(garbage disposal)\b/gi, 'triturador de basura'],
    [/\b(kitchen sink)\b/gi, 'fregadero de la cocina'],
    [/\b(bathroom sink)\b/gi, 'lavabo del baño'],
    [/\b(smoke detector)\b/gi, 'detector de humo'],
    [/\b(ceiling fan)\b/gi, 'ventilador de techo'],
    [/\b(front door)\b/gi, 'puerta principal'],
    [/\b(back door)\b/gi, 'puerta trasera'],
    [/\b(patio door|sliding door)\b/gi, 'puerta corrediza del patio'],
    [/\b(light fixture)\b/gi, 'lámpara de techo'],
    [/\b(circuit breaker|breaker box)\b/gi, 'caja de fusibles'],
    [/\b(washing machine|washer)\b/gi, 'lavadora'],
    [/\b(dryer)\b/gi, 'secadora'],
    [/\b(refrigerator|fridge)\b/gi, 'refrigerador'],
    [/\b(dishwasher)\b/gi, 'lavavajillas'],
    [/\b(stove|oven)\b/gi, 'estufa / horno'],
    [/\b(microwave)\b/gi, 'microondas'],
    [/\b(deadbolt|lock)\b/gi, 'cerradura'],
    [/\b(faucet)\b/gi, 'grifo / llave'],
    [/\b(toilet)\b/gi, 'inodoro'],
    [/\b(drain)\b/gi, 'drenaje'],
    [/\b(pipe)\b/gi, 'tubería'],
    [/\b(window)\b/gi, 'ventana'],
    [/\b(hallway)\b/gi, 'pasillo'],
    [/\b(kitchen)\b/gi, 'cocina'],
    [/\b(bathroom)\b/gi, 'baño'],
    [/\b(bedroom)\b/gi, 'recámara'],
    [/\b(living room)\b/gi, 'sala'],
    [/\b(closet)\b/gi, 'clóset'],
    [/\b(carpet)\b/gi, 'alfombra'],
    [/\b(leaking water|leaking)\b/gi, 'goteando agua'],
    [/\b(dripping)\b/gi, 'goteando'],
    [/\b(flooding|overflowing)\b/gi, 'desbordándose / inundando'],
    [/\b(broken|damaged)\b/gi, 'roto / averiado'],
    [/\b(clogged|blocked)\b/gi, 'tapado / obstruido'],
    [/\b(jammed|stuck)\b/gi, 'atascado / trabado'],
    [/\b(flickering)\b/gi, 'parpadeando'],
    [/\b(beeping|chirping)\b/gi, 'pitando'],
    [/\b(not working|doesn't work|not functioning)\b/gi, 'no funciona'],
    [/\b(not cooling)\b/gi, 'no enfría'],
    [/\b(not heating)\b/gi, 'no calienta'],
    [/\b(not spinning)\b/gi, 'no gira'],
    [/\b(not draining)\b/gi, 'no drena el agua'],
    [/\b(sparking)\b/gi, 'sacando chispas'],
    [/\b(squeaking)\b/gi, 'rechinando'],
    [/\b(smelling like smoke|smells like smoke)\b/gi, 'huele a humo'],
    [/\b(gas smell|smells like gas)\b/gi, 'olor a gas'],
    [/\b(water pressure)\b/gi, 'presión de agua'],
    [/\b(as soon as possible|ASAP)\b/gi, 'lo antes posible'],
    [/\b(please fix|please repair)\b/gi, 'por favor reparar'],
    [/\b(please check)\b/gi, 'por favor revisar'],
    [/\b(urgent|emergency)\b/gi, 'urgente'],
    [/\b(permission to enter)\b/gi, 'permiso para entrar'],
    [/\b(resident note|resident notes)\b/gi, 'notas del residente'],
    [/\b(completed|done)\b/gi, 'completado'],
    [/\b(replaced)\b/gi, 'reemplazado'],
    [/\b(repaired|fixed)\b/gi, 'reparado'],
    [/\b(parts ordered)\b/gi, 'partes ordenadas'],
    [/\b(inspected)\b/gi, 'inspeccionado'],
  ];

  let result = t;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }

  // If text started with capital, ensure it stays capitalized
  if (result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }

  return result;
}

/**
 * Translates work order texts to Spanish using Gemini API (gemini-3.8-flash)
 * with robust fallback handling.
 */
export async function translateWorkOrderContent(
  payload: TranslationPayload
): Promise<TranslationResult> {
  const { title, description = '', comments = [] } = payload;
  const ai = getGenAI();

  if (!ai) {
    // Graceful dictionary fallback
    return {
      title: fallbackTranslateToSpanish(title),
      description: description ? fallbackTranslateToSpanish(description) : '',
      comments: comments.map((c) => fallbackTranslateToSpanish(c)),
      source: 'dictionary-fallback',
    };
  }

  try {
    const prompt = `You are a professional maintenance translator assisting Spanish-speaking maintenance and repair technicians in an apartment / residential community.

Translate the following English maintenance work order into clear, direct, and natural Mexican / Latin American Spanish commonly used in maintenance, plumbing, HVAC, electrical, and facility repair work.

Items to translate:
1. Title: "${title}"
2. Description / Resident Notes: "${description}"
3. Comments: ${JSON.stringify(comments)}

Requirements:
- Provide natural, accurate Spanish translations for maintenance crew members.
- Keep technical terms accurate (e.g., A/C -> Aire acondicionado, breaker -> caja de fusibles, disposal -> triturador).
- Preserve all unit numbers, names, phone numbers, and formatting.
- Return valid JSON matching the schema with "title", "description", and "comments".`;

    const response = await withTimeout(ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction:
          'You are a specialized Spanish translator for residential property maintenance work orders. Output clean JSON only.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Translated title in clear Spanish',
            },
            description: {
              type: Type.STRING,
              description: 'Translated description/notes in clear Spanish',
            },
            comments: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Translated comments in Spanish in the exact same array sequence',
            },
          },
          required: ['title'],
        },
      },
    }));

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini translation');
    }

    const parsed = JSON.parse(text);
    return {
      title: parsed.title || fallbackTranslateToSpanish(title),
      description:
        parsed.description !== undefined
          ? parsed.description
          : description
          ? fallbackTranslateToSpanish(description)
          : '',
      comments: Array.isArray(parsed.comments)
        ? parsed.comments
        : comments.map((c) => fallbackTranslateToSpanish(c)),
      source: 'gemini',
    };
  } catch (err) {
    console.warn('Gemini translation notice (falling back to dictionary):', err);
    return {
      title: fallbackTranslateToSpanish(title),
      description: description ? fallbackTranslateToSpanish(description) : '',
      comments: comments.map((c) => fallbackTranslateToSpanish(c)),
      source: 'dictionary-fallback',
    };
  }
}
