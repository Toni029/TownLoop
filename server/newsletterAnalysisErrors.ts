/** Only fixed, privacy-safe classifications may leave the analysis boundary. */
export function newsletterAnalysisFailure(error: any) {
    const message = String(error?.message || '');
    const status = Number(error?.status) || Number(message.match(/\b(400|401|403|404|408|429|500|502|503|504)\b/)?.[1]) || undefined;
    let code = 'gemini-failed', httpStatus = 502, retryable = false;
    let explanation = 'Gemini could not finish newsletter analysis.';
    const failureStage = error instanceof SyntaxError ? 'response-parsing' :
        ['gemini-upload', 'pdf-rendering', 'response-parsing'].includes(error?.newsletterStage) ? error.newsletterStage : 'model-processing';
    if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid|PERMISSION_DENIED|UNAUTHENTICATED/i.test(message)) {
        code = 'gemini-configuration'; httpStatus = 503;
        explanation = 'The secure Gemini service needs an administrator configuration check.';
    } else if (status === 429 || /RESOURCE_EXHAUSTED/.test(message)) {
        code = 'gemini-quota'; httpStatus = 429; retryable = true;
        explanation = 'Gemini reached its request or quota limit. Wait before retrying analysis.';
    } else if (status === 408 || status === 504 || /timeout|timed out|DEADLINE_EXCEEDED|abort/i.test(message)) {
        code = 'gemini-timeout'; httpStatus = 504; retryable = true;
        explanation = 'Gemini analysis timed out. Retry analysis in a few minutes.';
    } else if ([500, 502, 503].includes(status!) || /unavailable/i.test(message)) {
        code = 'gemini-unavailable'; httpStatus = 503; retryable = true;
        explanation = 'Gemini is temporarily unavailable. Retry analysis in a few minutes.';
    } else if (status === 404) {
        code = 'gemini-model-unavailable'; httpStatus = 503;
        explanation = 'The configured Gemini model is unavailable. Ask an administrator to check the service.';
    } else if (failureStage === 'response-parsing') {
        code = 'gemini-response'; retryable = true;
        explanation = 'Gemini returned an incomplete or unreadable analysis. Retry analysis.';
    }
    return {code, httpStatus, retryable, failureStage, upstreamStatus: status,
        error: `${explanation} Your uploaded PDF is retained; no reupload is needed. The published newsletter is unchanged.`};
}

/** Retry only transient provider failures, within the same overall analysis deadline. */
export async function retryGeminiGeneration<T>(operation: (timeout: number) => Promise<T>, options: {
    deadline: number; timeout: number; attempts: number;
    wait?: (ms: number) => Promise<void>; now?: () => number;
}): Promise<T> {
    const now = options.now || Date.now;
    const wait = options.wait || (ms => new Promise(resolve => setTimeout(resolve, ms)));
    for (let attempt = 0; attempt < options.attempts; attempt++) {
        const remaining = options.deadline - now();
        if (remaining <= 0) throw Object.assign(Error('Gemini analysis deadline exceeded.'), {status: 504});
        try { return await operation(Math.min(options.timeout, remaining)); }
        catch (error) {
            const failure = newsletterAnalysisFailure(error);
            if (!failure.retryable || failure.failureStage === 'response-parsing' || attempt + 1 >= options.attempts) throw error;
            const delay = 1000 * 2 ** attempt + Math.floor(Math.random() * 250);
            if (options.deadline - now() <= delay) throw error;
            await wait(delay);
        }
    }
    throw Error('Gemini analysis did not run.');
}
