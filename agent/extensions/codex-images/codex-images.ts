import type { AssistantImages, FetchFunction, ProviderImages, Usage } from '@earendil-works/pi-ai';

export const BASE_URL = 'https://chatgpt.com/backend-api/codex';
const TIMEOUT_MS = 5 * 60 * 1000;
const LOGIN_MESSAGE = 'Sign in to ChatGPT/Codex with /login (openai-codex), then retry.';

/** Decode the same claim as Pi's private extractAccountId; never expose a bad JWT. */
function extractAccountId(token: string): string {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error();
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const id = payload?.['https://api.openai.com/auth']?.chatgpt_account_id;
    if (typeof id !== 'string' || !id.trim()) throw new Error();
    return id;
  } catch {
    throw new Error(`Cannot read the ChatGPT account id from the Codex credential. ${LOGIN_MESSAGE}`);
  }
}

/** Subscription usage has no API cost; absent or invalid token counts count as zero. */
function parseUsage(raw: any): Usage {
  const count = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
  const input = count(raw?.input_tokens);
  const output = count(raw?.output_tokens);
  return {
    input,
    output,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: raw?.total_tokens === undefined ? input + output : count(raw.total_tokens),
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

/** Prefer a server's human-readable message, with plain text as a fallback. */
function serverMessage(text: string): string {
  try {
    const body = JSON.parse(text);
    const message = body?.error?.message ?? body?.message ?? body?.detail ?? body?.error;
    if (typeof message === 'string') return message;
  } catch {
    // Proxies sometimes return plain text or HTML instead of the backend's JSON.
  }
  return text || 'Empty response body';
}

/** Inject I/O so offline tests never need credentials or contact the subscription backend. */
export function createGenerateImages(
  fetch: FetchFunction,
  getAccessToken: () => Promise<string | undefined>,
): ProviderImages['generateImages'] {
  /** Bound the whole operation, including credential refresh, and normalize every failure. */
  return async function generateImages(model, context, options) {
    const result: AssistantImages = {
      api: model.api,
      provider: model.provider,
      model: model.id,
      output: [],
      usage: parseUsage(undefined),
      stopReason: 'stop',
      timestamp: Date.now(),
    };
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const signal = AbortSignal.any(options?.signal ? [options.signal, timeout] : [timeout]);
    let token: string | undefined;
    let requestId: string | null = null;
    let status: number | undefined;
    let removeAbortListener = () => {};

    try {
      signal.throwIfAborted();
      const aborted = new Promise<never>((_resolve, reject) => {
        // Racing also bounds a resolver or test fetch that does not support cancellation.
        const onAbort = () => reject(signal.reason);
        signal.addEventListener('abort', onAbort, { once: true });
        removeAbortListener = () => signal.removeEventListener('abort', onAbort);
      });

      /** Keep the wire flow together; cancellation must prevent later HTTP work. */
      const request = async () => {
        const texts: string[] = [];
        const images: { image_url: string }[] = [];
        for (const block of context.input) {
          if (block.type === 'text' && typeof block.text === 'string') {
            texts.push(block.text);
          } else if (block.type === 'image' && typeof block.data === 'string' && block.data.length > 0 &&
            typeof block.mimeType === 'string' && /^image\/[\w.+-]+$/.test(block.mimeType)) {
            images.push({ image_url: `data:${block.mimeType};base64,${block.data}` });
          } else {
            throw new Error('Invalid image input: expected text or a base64 image with an image MIME type.');
          }
        }
        // Preserve prompt whitespace: the server ignores `size`, so aspect ratio lives in the prompt.
        const prompt = texts.join('\n\n');
        if (!prompt.trim()) throw new Error('A non-empty image prompt is required.');
        if (images.length > 5) throw new Error('Codex image edits accept at most 5 reference images.');

        try {
          token = await getAccessToken();
        } catch {
          // Credential errors can contain secrets; expose only actionable login guidance.
          throw new Error(`Cannot resolve the ChatGPT/Codex credential. ${LOGIN_MESSAGE}`);
        }
        signal.throwIfAborted();
        if (!token) throw new Error(`No ChatGPT/Codex access token available. ${LOGIN_MESSAGE}`);
        const accountId = extractAccountId(token);
        let body: unknown = {
          prompt,
          model: 'gpt-image-2',
          background: model.id === 'chatgpt-images-transparent' ? 'transparent' : 'opaque',
          quality: 'auto',
          size: 'auto',
          ...(images.length ? { images } : {}),
        };
        const replacement = await options?.onPayload?.(body, model);
        if (replacement !== undefined) body = replacement;
        signal.throwIfAborted();
        // Forward configured headers, then set the subscription headers last so callers cannot
        // replace them (Headers is case-insensitive). Null values only suppress defaults, and this
        // provider has none besides the reserved ones. Ignore options.apiKey: it is the placeholder.
        const headers = new Headers();
        for (const [name, value] of Object.entries(options?.headers ?? {})) {
          if (typeof value === 'string') headers.set(name, value);
        }
        headers.set('authorization', `Bearer ${token}`);
        headers.set('chatgpt-account-id', accountId);
        headers.set('originator', 'pi');
        headers.set('content-type', 'application/json');
        const response = await (options?.fetch ?? fetch)(`${BASE_URL}/images/${images.length ? 'edits' : 'generations'}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal,
        });
        status = response.status;
        requestId = response.headers.get('x-codex-imagegen-request-id');
        await options?.onResponse?.({ status, headers: Object.fromEntries(response.headers) }, model);
        const text = await response.text();
        signal.throwIfAborted();
        if (!response.ok) throw new Error(serverMessage(text));
        let raw: any;
        try {
          raw = JSON.parse(text);
        } catch {
          throw new Error('Malformed Codex image response: invalid JSON.');
        }
        if (!Array.isArray(raw?.data) || raw.data.length === 0 || raw.data.some((image: any) =>
          typeof image?.b64_json !== 'string' || !image.b64_json.trim())) {
          throw new Error('Malformed Codex image response: expected non-empty data with base64 images.');
        }
        result.output = raw.data.map((image: { b64_json: string }) => ({
          type: 'image', data: image.b64_json, mimeType: 'image/png',
        }));
        result.usage = parseUsage(raw.usage);
        return result;
      };
      return await Promise.race([request(), aborted]);
    } catch (error) {
      result.stopReason = options?.signal?.aborted ? 'aborted' : 'error';
      let message = options?.signal?.aborted ? 'Image request aborted.' : timeout.aborted ?
        'Codex image request timed out after 5 minutes.' : error instanceof Error ? error.message : String(error);
      let id = requestId ?? '';
      // Redact before truncation so even a server echo cannot reveal part of the token.
      for (const secret of [token, options?.apiKey]) {
        if (secret) {
          message = message.replaceAll(secret, '[redacted]');
          id = id.replaceAll(secret, '[redacted]');
        }
      }
      // Keep the request id even when the server message is long.
      result.errorMessage = `${status !== undefined ? `HTTP ${status}: ` : ''}` +
        `${message.slice(0, 500)}${message.length > 500 ? '…' : ''}` +
        `${id ? ` (imagegen request id: ${id.slice(0, 200)})` : ''}`;
      return result;
    } finally {
      removeAbortListener();
    }
  };
}
