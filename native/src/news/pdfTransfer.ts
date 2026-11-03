/** Keeps the existing Firestore PDF format, without materializing a complete native Base64 string. */
export const PDF_PREFIX = 'data:application/pdf;base64,';
export const PDF_CHUNK_BYTES = 480 * 1024; // Multiple of three: concatenated Base64 remains byte-exact.
export const PDF_BATCH_CHUNKS = 1; // ~640 KiB per request: bounded acknowledgements on slow mobile links.
export type PdfSource = {
    name: string;
    size: number;
    identity: string;
    preparationMs: number;
    readBase64: (offset: number, length: number) => Promise<string>;
    readDataUrl: () => Promise<string>;
    dispose: () => void;
};
export type TransferProgress = {
    confirmedBytes: number;
    totalBytes: number;
    percent: number;
};
export type PdfChunk = {
    index: number;
    data: string;
    bytes: number;
};
type Batch = {
    promise: Promise<void>;
    confirmed: boolean;
    failed: boolean;
    bytes: number;
};
export type UploadResume = {
    key?: string;
    sourceIdentity?: string;
    batches: Map<number, Batch>;
};
export const newUploadResume = (): UploadResume => ({ batches: new Map() });
export class PdfUploadCancelled extends Error {
    constructor() { super('Upload paused. Retry to resume confirmed progress.'); this.name = 'PdfUploadCancelled'; }
}
function waitForCommit(promise: Promise<void>, signal?: AbortSignal, timeoutMs?: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const stop = () => finish(new PdfUploadCancelled());
        // The transport owns abortable per-request deadlines and bounded retries. Do not
        // time out its whole retry sequence while retaining a live unresolved request.
        const timer = timeoutMs === undefined ? undefined : setTimeout(() => finish(Error('Upload confirmation timed out. Retry will check the existing transfer before sending again.')), timeoutMs);
        const finish = (error?: unknown) => { clearTimeout(timer); signal?.removeEventListener('abort', stop); error ? reject(error) : resolve(); };
        signal?.addEventListener('abort', stop, { once: true });
        promise.then(() => finish(), finish);
        if (signal?.aborted)
            stop();
    });
}
export function stringPdfSource(dataUrl: string): PdfSource {
    const body = dataUrl.slice(PDF_PREFIX.length), padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0;
    return { name: 'Newsletter.pdf', identity: dataUrl, size: Math.floor(body.length * 3 / 4) - padding, preparationMs: 0,
        readBase64: async (offset, length) => body.slice(offset / 3 * 4, Math.ceil((offset + length) / 3) * 4),
        readDataUrl: async () => dataUrl, dispose: () => { } };
}
/** At most two batch commits/two chunks are in flight; progress counts server-confirmed original PDF bytes. */
export async function transferPdf(input: {
    source: PdfSource;
    key: string;
    resume: UploadResume;
    signal?: AbortSignal;
    check: () => void;
    commit: (chunks: PdfChunk[]) => Promise<void>;
    progress: (value: TransferProgress) => void;
    confirmationTimeoutMs?: number;
    confirmedChunks?: Set<number>;
    metrics?: (value: { totalChunks: number; totalSize: number; readMs: number; commitMs: number; elapsedMs: number; commits: number }) => void;
    now?: () => number;
}) {
    const { source, resume } = input, now = input.now || (() => performance.now());
    if (resume.key && (resume.key !== input.key || resume.sourceIdentity !== source.identity))
        throw Error('Upload draft changed. Select the PDF again.');
    resume.key = input.key;
    resume.sourceIdentity = source.identity;
    let stopped = false, next = 0, readMs = 0, commitMs = 0, commits = 0;
    let firstFailure: unknown;
    const waits = new AbortController();
    const abortWaits = () => waits.abort();
    input.signal?.addEventListener('abort', abortWaits, { once: true });
    if (input.signal?.aborted)
        waits.abort();
    const started = now(), totalChunks = Math.ceil(source.size / PDF_CHUNK_BYTES), batches = Math.ceil(totalChunks / PDF_BATCH_CHUNKS);
    // Server receipts were matched against this file before transfer. Seed them
    // so recovery reports real progress immediately and never rereads them here.
    for (let batch = 0; batch < batches; batch++) {
        const first = batch * PDF_BATCH_CHUNKS, last = Math.min(totalChunks, first + PDF_BATCH_CHUNKS);
        if (input.confirmedChunks && Array.from({length: last - first}, (_, i) => first + i).every(index => input.confirmedChunks!.has(index)))
            resume.batches.set(batch, {promise: Promise.resolve(), confirmed: true, failed: false, bytes: Math.min(source.size, last * PDF_CHUNK_BYTES) - first * PDF_CHUNK_BYTES});
    }
    const check = () => { input.check(); if (stopped || input.signal?.aborted)
        throw new PdfUploadCancelled(); };
    const report = () => { if (!stopped && !input.signal?.aborted) {
        input.check();
        const confirmedBytes = [...resume.batches.values()].reduce((n, b) => n + (b.confirmed ? b.bytes : 0), 0);
        input.progress({ confirmedBytes, totalBytes: source.size, percent: Math.floor(confirmedBytes / source.size * 100) });
    } };
    async function worker() {
        try {
            while (next < batches) {
                check();
                const batch = next++;
                let record = resume.batches.get(batch);
                if (!record || record.failed) {
                    const chunks: PdfChunk[] = [];
                    for (let i = batch * PDF_BATCH_CHUNKS; i < Math.min(totalChunks, (batch + 1) * PDF_BATCH_CHUNKS); i++) {
                        check();
                        const offset = i * PDF_CHUNK_BYTES, length = Math.min(PDF_CHUNK_BYTES, source.size - offset), before = now();
                        const data = await source.readBase64(offset, length);
                        readMs += now() - before;
                        check();
                        if (data.length !== Math.ceil(length / 3) * 4 || i === 0 && !data.startsWith('JVBERi0'))
                            throw Error('The selected PDF changed or could not be read. Select it again.');
                        chunks.push({ index: i, data: (i === 0 ? PDF_PREFIX : '') + data, bytes: length });
                    }
                    check();
                    const before = now();
                    record = { promise: Promise.resolve(), confirmed: false, failed: false, bytes: chunks.reduce((n, c) => n + c.bytes, 0) };
                    const owned = record;
                    resume.batches.set(batch, owned);
                    commits++;
                    // Retain this exact pending promise across pause/timeout: ambiguous outcomes are never blindly resent.
                    owned.promise = Promise.resolve().then(() => input.commit(chunks)).then(() => { owned.confirmed = true; commitMs += now() - before; }, error => { owned.failed = true; throw error; });
                    void owned.promise.catch(() => { });
                }
                await waitForCommit(record.promise, waits.signal, input.confirmationTimeoutMs);
                check();
                report();
            }
        }
        catch (error) {
            if (!stopped) {
                firstFailure = error;
                stopped = true;
                waits.abort();
            }
            throw error;
        }
    }
    try {
        check();
        report();
        const results = await Promise.allSettled([worker(), worker()]);
        stopped = true;
        if (results.some(r => r.status === 'rejected'))
            throw firstFailure;
        return { totalChunks, totalSize: PDF_PREFIX.length + Math.ceil(source.size / 3) * 4, readMs, commitMs, elapsedMs: now() - started, commits };
    }
    finally {
        input.signal?.removeEventListener('abort', abortWaits);
        input.metrics?.({totalChunks, totalSize: PDF_PREFIX.length + Math.ceil(source.size / 3) * 4, readMs, commitMs, elapsedMs: now() - started, commits});
    }
}
