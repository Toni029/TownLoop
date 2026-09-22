/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */

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
  source: 'google-translate' | 'fallback';
}

/**
 * Intelligent domain-specific dictionary and pattern replacer for property maintenance and repair
 */
export function fallbackTranslateToSpanish(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let t = text.trim();

  // Common complete phrases mapping
  const commonExactPhrases: Record<string, string> = {
    'Master bathroom sink dripping constantly': 'Lavabo del baño principal goteando constantemente',
    'Hot water faucet has a slow drip that got worse over the weekend.': 'La llave de agua caliente tiene un goteo lento que empeoró durante el fin de semana.',
    'Patio screen door off track': 'Puerta mosquitera del patio fuera de riel',
    'The sliding screen door keeps jamming when opening.': 'La puerta corrediza con mosquitero se sigue trabando al abrir.',
    'AC leaking water in hallway': 'Aire acondicionado goteando agua en el pasillo',
    'Garbage disposal broken': 'Triturador de basura descompuesto',
    'Kitchen sink faucet dripping': 'Grifo del fregadero de la cocina goteando',
    'Water heater not heating': 'El calentador de agua no está calentando',
    'Front door lock jammed': 'Cerradura de la puerta principal atascada',
    'Toilet running constantly': 'El inodoro corre agua constantemente',
    'Toilet constantly running': 'El inodoro corre agua constantemente',
    'Smoke detector beeping': 'Detector de humo pitando (cambio de batería)',
    'Light fixture flickering': 'Lámpara de techo parpadeando',
    'Clogged bathroom drain': 'Drenaje del baño tapado / obstruido',
    'Broken window latch': 'Pestillo o seguro de ventana roto',
    'Refrigerator not cooling': 'El refrigerador no está enfriando',
    'Dishwasher leaking soap': 'Lavavajillas goteando agua con jabón',
    'Dryer not spinning': 'La secadora no está girando',
    'Washer overflowing': 'La lavadora se está desbordando',
    'Ceiling fan squeaking': 'El ventilador de techo rechinando al girar',
    'Outlet sparking in kitchen': 'Enchufe sacando chispas en la cocina',
    'Door handle loose': 'Manija de la puerta floja',
    'Permission to enter given': 'Permiso otorgado para ingresar a la unidad',
    'Permission to enter': 'Permiso para ingresar',
    'Please fix as soon as possible': 'Por favor reparar lo más pronto posible',
    'Please call before entering': 'Por favor llamar antes de entrar',
    'Dog in bedroom': 'Hay perro en la recámara',
    'Cat inside': 'Gato adentro de la vivienda',
    'Technician currently on site': 'Técnico actualmente en el sitio',
    'Queued for maintenance technician': 'En cola para técnico de mantenimiento',
    'Pending review': 'Pendiente de revisión',
    'Work completed': 'Trabajo completado',
    'Repaired and tested': 'Reparado y probado',
    'Replaced parts': 'Partes reemplazadas',
    'Parts ordered': 'Partes ordenadas',
    'Waiting on parts': 'En espera de repuestos',
  };

  if (commonExactPhrases[t]) {
    return commonExactPhrases[t];
  }

  // Common replacements
  const replacements: [RegExp, string][] = [
    [/\bmaster bathroom sink\b/gi, 'lavabo del baño principal'],
    [/\bmaster bathroom\b/gi, 'baño principal'],
    [/\bguest bathroom\b/gi, 'baño de visitas'],
    [/\bhalf bath\b/gi, 'medio baño'],
    [/\bkitchen sink\b/gi, 'fregadero de la cocina'],
    [/\bbathroom sink\b/gi, 'lavabo del baño'],
    [/\bmaster bedroom\b/gi, 'recámara principal'],
    [/\bliving room\b/gi, 'sala'],
    [/\bdining room\b/gi, 'comedor'],
    [/\blaundry room\b/gi, 'cuarto de lavado'],
    [/\bpatio screen door\b/gi, 'puerta mosquitera del patio'],
    [/\bsliding screen door\b/gi, 'puerta corrediza con mosquitero'],
    [/\bsliding glass door\b/gi, 'puerta corrediza de vidrio'],
    [/\bscreen door\b/gi, 'puerta mosquitera'],
    [/\bfront door\b/gi, 'puerta principal'],
    [/\bback door\b/gi, 'puerta trasera'],
    [/\bpatio door\b/gi, 'puerta del patio'],
    [/\bbalcony door\b/gi, 'puerta del balcón'],
    [/\bcloset door\b/gi, 'puerta del clóset'],
    [/\b(AC unit|A\/C unit|AC system|A\/C system)\b/gi, 'unidad de aire acondicionado'],
    [/\b(AC|A\/C|air conditioner|air conditioning)\b/gi, 'aire acondicionado'],
    [/\b(water heater)\b/gi, 'calentador de agua'],
    [/\bhot water\b/gi, 'agua caliente'],
    [/\bcold water\b/gi, 'agua fría'],
    [/\b(garbage disposal)\b/gi, 'triturador de basura'],
    [/\b(smoke detector)\b/gi, 'detector de humo'],
    [/\b(carbon monoxide detector)\b/gi, 'detector de monóxido de carbono'],
    [/\b(ceiling fan)\b/gi, 'ventilador de techo'],
    [/\b(exhaust fan)\b/gi, 'extractor de aire'],
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
    [/\b(pipe|pipes)\b/gi, 'tubería'],
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
 * Decodes common HTML entities returned by Google Translate v2
 */
function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;|&apos;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

/**
 * Google Translate API key resolution from environment variable
 * Secure placeholder: process.env.GOOGLE_TRANSLATE_API_KEY or process.env.REACT_APP_GOOGLE_TRANSLATE_API_KEY
 */
function getGoogleTranslateApiKey(): string {
  return (
    process.env.GOOGLE_TRANSLATE_API_KEY ||
    process.env.REACT_APP_GOOGLE_TRANSLATE_API_KEY ||
    process.env.GOOGLE_CLOUD_TRANSLATION_API_KEY ||
    ''
  ).trim();
}

/**
 * Batch-translates work order title, description/notes, and comments together
 * in a single Google Cloud Translation API (Basic v2 endpoint) request using standard fetch.
 * Fails gracefully with domain dictionary fallback if network drops or key is absent.
 */
export async function translateWorkOrderContent(
  payload: TranslationPayload
): Promise<TranslationResult> {
  const { title, description = '', comments = [], targetLang = 'es' } = payload;
  const apiKey = getGoogleTranslateApiKey();

  // If no API key is provided, fail gracefully to instant fallback dictionary
  if (!apiKey) {
    return {
      title: fallbackTranslateToSpanish(title),
      description: description ? fallbackTranslateToSpanish(description) : '',
      comments: comments.map((c) => fallbackTranslateToSpanish(c)),
      source: 'fallback',
    };
  }

  // Construct batch array for the single Google Translate API Basic v2 call
  // We index items so we can simultaneously unpack them upon response
  const batchTexts: string[] = [];
  const titleIdx = title ? batchTexts.push(title) - 1 : -1;
  const descIdx = description ? batchTexts.push(description) - 1 : -1;
  const commentIndices: number[] = [];

  for (const c of comments) {
    if (c) {
      commentIndices.push(batchTexts.push(c) - 1);
    } else {
      commentIndices.push(-1);
    }
  }

  if (batchTexts.length === 0) {
    return {
      title,
      description,
      comments,
      source: 'google-translate',
    };
  }

  try {
    const endpoint = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`;

    // Abort controller with 8s timeout to handle network drops gracefully
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        q: batchTexts,
        target: targetLang,
        format: 'text',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.warn(`Google Cloud Translation API error (HTTP ${response.status}):`, errorText);
      throw new Error(`Google Cloud Translation API returned status ${response.status}`);
    }

    const data = await response.json();
    const translations = data?.data?.translations;

    if (!Array.isArray(translations)) {
      throw new Error('Malformed response from Google Cloud Translation API');
    }

    const translatedTitle =
      titleIdx >= 0 && translations[titleIdx]?.translatedText
        ? decodeHtmlEntities(translations[titleIdx].translatedText)
        : fallbackTranslateToSpanish(title);

    const translatedDesc =
      descIdx >= 0 && translations[descIdx]?.translatedText
        ? decodeHtmlEntities(translations[descIdx].translatedText)
        : description
        ? fallbackTranslateToSpanish(description)
        : '';

    const translatedComments = commentIndices.map((idx, i) => {
      if (idx >= 0 && translations[idx]?.translatedText) {
        return decodeHtmlEntities(translations[idx].translatedText);
      }
      return fallbackTranslateToSpanish(comments[i] || '');
    });

    return {
      title: translatedTitle,
      description: translatedDesc,
      comments: translatedComments,
      source: 'google-translate',
    };
  } catch (error) {
    // Fails gracefully if network drops or service is unavailable
    console.warn('Google Translation network/service notice (falling back gracefully):', error);
    return {
      title: fallbackTranslateToSpanish(title),
      description: description ? fallbackTranslateToSpanish(description) : '',
      comments: comments.map((c) => fallbackTranslateToSpanish(c)),
      source: 'fallback',
    };
  }
}

