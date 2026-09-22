import { WorkOrderItem } from '../types';

export interface TranslatedContent {
  title: string;
  description: string;
  comments: Record<string | number, string>;
  isSpanish: boolean;
}

// In-memory cache for instant toggling without re-computation
const translationCache = new Map<string, TranslatedContent>();

/**
 * Common exact phrases for apartment maintenance & repairs
 */
const COMMON_EXACT_PHRASES: Record<string, string> = {
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
  'Resident note': 'Nota del residente',
  'Resident notes': 'Notas del residente',
};

/**
 * Ordered regex patterns for compound and single maintenance terms
 */
const PATTERN_REPLACEMENTS: [RegExp, string][] = [
  // Multi-word compound locations & items
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
  [/\bwater heater\b/gi, 'calentador de agua'],
  [/\bhot water\b/gi, 'agua caliente'],
  [/\bcold water\b/gi, 'agua fría'],
  [/\bgarbage disposal\b/gi, 'triturador de basura'],
  [/\bsmoke detector\b/gi, 'detector de humo'],
  [/\bcarbon monoxide detector\b/gi, 'detector de monóxido de carbono'],
  [/\b(circuit breaker|breaker box)\b/gi, 'caja de fusibles'],
  [/\blight fixture\b/gi, 'lámpara de techo'],
  [/\bceiling fan\b/gi, 'ventilador de techo'],
  [/\bexhaust fan\b/gi, 'extractor de aire'],
  [/\b(washing machine|clothes washer)\b/gi, 'lavadora'],
  [/\b(clothes dryer|drying machine)\b/gi, 'secadora'],
  [/\bwindow latch\b/gi, 'seguro de la ventana'],
  [/\bwindow frame\b/gi, 'marco de la ventana'],
  [/\bwindow screen\b/gi, 'malla de la ventana'],
  [/\b(deadbolt lock|deadbolt)\b/gi, 'cerradura de cerrojo'],
  [/\b(door lock)\b/gi, 'cerradura de la puerta'],
  [/\b(door handle|doorknob|door knob)\b/gi, 'manija de la puerta'],
  [/\bshower head\b/gi, 'cabezal de la regadera'],
  [/\btoilet seat\b/gi, 'asiento del inodoro'],
  [/\btoilet tank\b/gi, 'tanque del inodoro'],
  [/\btoilet bowl\b/gi, 'taza del inodoro'],
  [/\blow water pressure\b/gi, 'baja presión de agua'],
  [/\bwater pressure\b/gi, 'presión de agua'],
  [/\bwater supply\b/gi, 'suministro de agua'],
  [/\bwater leak\b/gi, 'fuga de agua'],
  [/\bwater damage\b/gi, 'daño por agua'],
  [/\bp-trap\b/gi, 'trampa de drenaje'],

  // Phrases & Conditions
  [/\bdripping constantly\b/gi, 'goteando constantemente'],
  [/\bconstantly dripping\b/gi, 'goteando constantemente'],
  [/\bleaking water\b/gi, 'goteando agua'],
  [/\boff track\b/gi, 'fuera de riel'],
  [/\bkeeps jamming\b/gi, 'se sigue trabando'],
  [/\bslow drip\b/gi, 'goteo lento'],
  [/\bgot worse\b/gi, 'empeoró'],
  [/\bover the weekend\b/gi, 'durante el fin de semana'],
  [/\bwhen opening\b/gi, 'al abrir'],
  [/\bwhen closing\b/gi, 'al cerrar'],
  [/\bwon't turn on\b/gi, 'no enciende'],
  [/\bwon't turn off\b/gi, 'no se apaga'],
  [/\bwon't open\b/gi, 'no abre'],
  [/\bwon't close\b/gi, 'no cierra'],
  [/\b(does not work|doesn't work|not working|not functioning)\b/gi, 'no funciona'],
  [/\bnot cooling\b/gi, 'no enfría'],
  [/\bnot heating\b/gi, 'no calienta'],
  [/\bnot spinning\b/gi, 'no gira'],
  [/\bnot draining\b/gi, 'no drena'],
  [/\bbacked up\b/gi, 'desbordado / tapado'],
  [/\bstopped up\b/gi, 'tapado'],
  [/\bclogged up\b/gi, 'obstruido / tapado'],
  [/\bburned out\b/gi, 'fundido'],
  [/\bsparking in\b/gi, 'sacando chispas en'],
  [/\bsmells like smoke\b/gi, 'huele a humo'],
  [/\bsmells like gas\b/gi, 'huele a gas'],
  [/\bgas smell\b/gi, 'olor a gas'],
  [/\bstrange smell\b/gi, 'olor extraño'],
  [/\bbad odor\b/gi, 'mal olor'],
  [/\bas soon as possible\b/gi, 'lo antes posible'],
  [/\bASAP\b/gi, 'lo antes posible'],
  [/\bplease call\b/gi, 'por favor llamar'],
  [/\bplease fix\b/gi, 'por favor reparar'],
  [/\bplease repair\b/gi, 'por favor reparar'],
  [/\bplease replace\b/gi, 'por favor reemplazar'],
  [/\bplease check\b/gi, 'por favor revisar'],
  [/\bpermission to enter\b/gi, 'permiso para entrar'],
  [/\bcall before entering\b/gi, 'llamar antes de entrar'],
  [/\bknock loudly\b/gi, 'tocar fuerte a la puerta'],
  [/\bpower outage\b/gi, 'corte de luz'],
  [/\bno power\b/gi, 'sin electricidad'],
  [/\bno hot water\b/gi, 'sin agua caliente'],
  [/\bparts ordered\b/gi, 'repuestos ordenados'],
  [/\bwaiting on parts\b/gi, 'esperando repuestos'],
  [/\bcurrently on site\b/gi, 'actualmente en el sitio'],
  [/\bunder the sink\b/gi, 'debajo del fregadero'],
  [/\bin the hallway\b/gi, 'en el pasillo'],
  [/\bin the kitchen\b/gi, 'en la cocina'],
  [/\bin the bathroom\b/gi, 'en el baño'],
  [/\bin the bedroom\b/gi, 'en la recámara'],
  [/\bin the living room\b/gi, 'en la sala'],
  [/\bin the closet\b/gi, 'en el clóset'],
  [/\bon the floor\b/gi, 'en el piso'],
  [/\bon the ceiling\b/gi, 'en el techo'],
  [/\bon the wall\b/gi, 'en la pared'],

  // Core Nouns & Fixtures
  [/\brefrigerator\b/gi, 'refrigerador'],
  [/\bfridge\b/gi, 'refrigerador'],
  [/\bfreezer\b/gi, 'congelador'],
  [/\bdishwasher\b/gi, 'lavavajillas'],
  [/\b(stove|range)\b/gi, 'estufa'],
  [/\boven\b/gi, 'horno'],
  [/\bmicrowave\b/gi, 'microondas'],
  [/\bwasher\b/gi, 'lavadora'],
  [/\bdryer\b/gi, 'secadora'],
  [/\bfaucet\b/gi, 'grifo / llave'],
  [/\bsink\b/gi, 'fregadero'],
  [/\btoilet\b/gi, 'inodoro'],
  [/\bshower\b/gi, 'regadera'],
  [/\bbathtub\b/gi, 'bañera'],
  [/\btub\b/gi, 'bañera'],
  [/\bdrain\b/gi, 'drenaje'],
  [/\bpipes\b/gi, 'tuberías'],
  [/\bpipe\b/gi, 'tubería'],
  [/\bthermostat\b/gi, 'termostato'],
  [/\bfurnace\b/gi, 'calefactor'],
  [/\bheater\b/gi, 'calentador'],
  [/\b(light bulb|bulb)\b/gi, 'foco'],
  [/\bswitch\b/gi, 'interruptor'],
  [/\b(outlet|socket)\b/gi, 'tomacorriente'],
  [/\bbreaker\b/gi, 'fusible / interruptor'],
  [/\bdoor\b/gi, 'puerta'],
  [/\bdoors\b/gi, 'puertas'],
  [/\bwindow\b/gi, 'ventana'],
  [/\bwindows\b/gi, 'ventanas'],
  [/\bblinds\b/gi, 'persianas'],
  [/\bblind\b/gi, 'persiana'],
  [/\block\b/gi, 'cerradura'],
  [/\bkeys\b/gi, 'llaves'],
  [/\bkey\b/gi, 'llave'],
  [/\bhandle\b/gi, 'manija'],
  [/\bknob\b/gi, 'perilla'],
  [/\bhinges\b/gi, 'bisagras'],
  [/\bhinge\b/gi, 'bisagra'],
  [/\bhallway\b/gi, 'pasillo'],
  [/\bkitchen\b/gi, 'cocina'],
  [/\bbathroom\b/gi, 'baño'],
  [/\bbedroom\b/gi, 'recámara'],
  [/\bliving room\b/gi, 'sala'],
  [/\bcloset\b/gi, 'clóset'],
  [/\bcarpet\b/gi, 'alfombra'],
  [/\bflooring\b/gi, 'piso'],
  [/\bfloor\b/gi, 'piso'],
  [/\bceiling\b/gi, 'techo'],
  [/\bwalls\b/gi, 'paredes'],
  [/\bwall\b/gi, 'pared'],
  [/\broof\b/gi, 'tejado'],
  [/\bgutter\b/gi, 'canaleta'],
  [/\bbalcony\b/gi, 'balcón'],
  [/\bpatio\b/gi, 'patio'],
  [/\bcabinet\b/gi, 'gabinete'],
  [/\bdrawer\b/gi, 'cajón'],
  [/\bcountertop\b/gi, 'mostrador'],
  [/\btile\b/gi, 'azulejo'],
  [/\bgrout\b/gi, 'lechada'],
  [/\bdrywall\b/gi, 'panel de yeso'],
  [/\bpaint\b/gi, 'pintura'],
  [/\bbaseboard\b/gi, 'zócalo'],

  // States & Verbs
  [/\bleaking\b/gi, 'goteando'],
  [/\bleaks\b/gi, 'gotea'],
  [/\bleak\b/gi, 'fuga'],
  [/\bdripping\b/gi, 'goteando'],
  [/\bdrips\b/gi, 'gotea'],
  [/\bdrip\b/gi, 'goteo'],
  [/\bflooding\b/gi, 'inundándose'],
  [/\boverflowing\b/gi, 'desbordándose'],
  [/\bclogged\b/gi, 'tapado'],
  [/\bblocked\b/gi, 'obstruido'],
  [/\bbroken\b/gi, 'roto'],
  [/\bdamaged\b/gi, 'dañado'],
  [/\bcracked\b/gi, 'agrietado'],
  [/\bjammed\b/gi, 'atascado'],
  [/\bstuck\b/gi, 'trabado'],
  [/\bloose\b/gi, 'flojo'],
  [/\bsqueaking\b/gi, 'rechinando'],
  [/\bflickering\b/gi, 'parpadeando'],
  [/\bbeeping\b/gi, 'pitando'],
  [/\bsparking\b/gi, 'sacando chispas'],
  [/\bnoisy\b/gi, 'ruidoso'],
  [/\burgent\b/gi, 'urgente'],
  [/\bemergency\b/gi, 'emergencia'],
  [/\bcompleted\b/gi, 'completado'],
  [/\bfixed\b/gi, 'reparado'],
  [/\brepaired\b/gi, 'reparado'],
  [/\breplaced\b/gi, 'reemplazado'],
  [/\binstalled\b/gi, 'instalado'],
  [/\binspected\b/gi, 'inspeccionado'],
  [/\bcleaned\b/gi, 'limpiado'],
  [/\btested\b/gi, 'probado'],
  [/\btightened\b/gi, 'ajustado'],
  [/\bunclogged\b/gi, 'destapado'],
  [/\btechnician\b/gi, 'técnico'],
  [/\bresident\b/gi, 'residente'],
  [/\bmaintenance\b/gi, 'mantenimiento'],
  [/\btoday\b/gi, 'hoy'],
  [/\btomorrow\b/gi, 'mañana'],
  [/\byesterday\b/gi, 'ayer'],
];

/**
 * Instant local text translation to Spanish using dictionary and pattern matching.
 * Executes synchronously in 0ms with zero AI calls and zero timeouts.
 */
export function instantTranslateToSpanish(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (!trimmed) return '';

  // 1. Check exact phrase match
  if (COMMON_EXACT_PHRASES[trimmed]) {
    return COMMON_EXACT_PHRASES[trimmed];
  }

  // 2. Perform patterned substitutions
  let translated = trimmed;
  for (const [pattern, replacement] of PATTERN_REPLACEMENTS) {
    translated = translated.replace(pattern, replacement);
  }

  // 3. Preserve leading capitalization if original text was capitalized
  if (translated.length > 0 && trimmed.charAt(0) === trimmed.charAt(0).toUpperCase()) {
    translated = translated.charAt(0).toUpperCase() + translated.slice(1);
  }

  return translated;
}

/**
 * Synchronous, instant work order translation into Spanish.
 */
export function translateWorkOrderSync(workOrder: WorkOrderItem): TranslatedContent {
  const commentsList = workOrder.comments || [];
  const commentMap: Record<string | number, string> = {};

  commentsList.forEach((c) => {
    commentMap[c.id] = instantTranslateToSpanish(c.text);
  });

  return {
    title: instantTranslateToSpanish(workOrder.title),
    description: workOrder.description ? instantTranslateToSpanish(workOrder.description) : '',
    comments: commentMap,
    isSpanish: true,
  };
}

/**
 * Secure placeholder for Google Translate API Key in client/config environments
 * Priority: process.env.REACT_APP_GOOGLE_TRANSLATE_API_KEY -> process.env.GOOGLE_TRANSLATE_API_KEY -> VITE_GOOGLE_TRANSLATE_API_KEY
 */
export const GOOGLE_TRANSLATE_API_KEY =
  (typeof process !== 'undefined' && process.env
    ? process.env.REACT_APP_GOOGLE_TRANSLATE_API_KEY || process.env.GOOGLE_TRANSLATE_API_KEY
    : '') ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env
    ? (import.meta as any).env.VITE_GOOGLE_TRANSLATE_API_KEY
    : '') ||
  '';

/**
 * Decodes HTML entities returned by Google Translate API v2
 */
export function decodeHtmlEntities(text: string): string {
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
 * Directly calls Google Cloud Translation API (Basic v2 endpoint) using standard fetch
 * Batches an array of query strings in a single POST request.
 */
export async function callGoogleCloudTranslationApiV2(
  texts: string[],
  targetLang: string = 'es',
  apiKey: string = GOOGLE_TRANSLATE_API_KEY
): Promise<string[]> {
  if (!texts || texts.length === 0) return [];
  if (!apiKey) {
    return texts.map(instantTranslateToSpanish);
  }

  const endpoint = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      q: texts,
      target: targetLang,
      format: 'text',
    }),
  });

  if (!response.ok) {
    throw new Error(`Google Cloud Translation API error: ${response.status}`);
  }

  const json = await response.json();
  const translations = json?.data?.translations;
  if (!Array.isArray(translations)) {
    throw new Error('Invalid response structure from Google Cloud Translation API');
  }

  return translations.map((t: any) => decodeHtmlEntities(t.translatedText || ''));
}

/**
 * Translates work order title, description, notes, and comments simultaneously
 * using the official Google Cloud Translation API (Basic v2 endpoint) via a single batch call.
 * If the network drops or the request fails, it fails gracefully so the UI never breaks.
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
    // Attempt batch translation via server proxy endpoint (which uses Google Cloud Translation API Basic v2)
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: workOrder.title,
        description: workOrder.description || '',
        comments: commentsList.map(({ text }) => text),
        targetLang: 'es',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const translatedCommentsList = Array.isArray(data.comments) ? data.comments : [];
      const commentMap: Record<string | number, string> = {};

      commentsList.forEach((c, index) => {
        commentMap[c.id] = translatedCommentsList[index] || c.text;
      });

      const result: TranslatedContent = {
        title: data.title || workOrder.title,
        description: data.description !== undefined ? data.description : workOrder.description || '',
        comments: commentMap,
        isSpanish: true,
      };

      translationCache.set(woKey, result);
      return result;
    }

    // If server returned non-OK, try direct client call if client API key placeholder is provided
    if (GOOGLE_TRANSLATE_API_KEY) {
      const batchQueries: string[] = [workOrder.title];
      if (workOrder.description) batchQueries.push(workOrder.description);
      commentsList.forEach((c) => batchQueries.push(c.text));

      const translatedBatch = await callGoogleCloudTranslationApiV2(
        batchQueries,
        'es',
        GOOGLE_TRANSLATE_API_KEY
      );

      let ptr = 0;
      const translatedTitle = translatedBatch[ptr++] || workOrder.title;
      const translatedDesc = workOrder.description ? translatedBatch[ptr++] || '' : '';
      const commentMap: Record<string | number, string> = {};
      commentsList.forEach((c) => {
        commentMap[c.id] = translatedBatch[ptr++] || c.text;
      });

      const result: TranslatedContent = {
        title: translatedTitle,
        description: translatedDesc,
        comments: commentMap,
        isSpanish: true,
      };

      translationCache.set(woKey, result);
      return result;
    }

    throw new Error(`Server translation responded with status ${response.status}`);
  } catch (error) {
    // Graceful error handling if network drops or service is temporarily unreachable
    console.warn('Network or Google Translation API notice (falling back gracefully):', error);
    const fallback = translateWorkOrderSync(workOrder);
    translationCache.set(woKey, fallback);
    return fallback;
  }
}

