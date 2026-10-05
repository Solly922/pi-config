import { randomUUID } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import type { ImageContent, ImageModel, ImagesContext, ProviderImages, Usage } from '@earendil-works/pi-ai';
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { BASE_URL, createGenerateImages } from './codex-images.ts';

const MAX_REFERENCES = 5;
const MAX_REFERENCE_BYTES = 20 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// Plain JSON Schema instead of TypeBox: 'typebox' only resolves inside Pi's loader, so importing it
// would stop `node --test` from loading this file. Pi validates and coerces plain schemas too
// (pi-ai utils/validation.js validateToolArguments).
const parameters = {
  type: 'object',
  properties: {
    prompt: { type: 'string', minLength: 1, description: 'Describe the image and its aspect ratio, e.g. 16:9 landscape.' },
    output_path: { type: 'string', minLength: 1, description: 'PNG destination; relative paths resolve against the session cwd.' },
    overwrite: { type: 'boolean', default: false },
    transparent: { type: 'boolean', default: false },
    reference_image_paths: {
      type: 'array', items: { type: 'string', minLength: 1 }, maxItems: MAX_REFERENCES,
      description: 'Up to 5 local PNG, JPEG, WebP or GIF files (20 MB each) to edit or use as references.',
    },
  },
  required: ['prompt', 'output_path'],
  additionalProperties: false,
};
type ImageParams = {
  prompt: string;
  output_path: string;
  overwrite?: boolean;
  transparent?: boolean;
  reference_image_paths?: string[];
};
type DecodedPng = { data: Buffer; width: number; height: number };
type ImageDetails = { paths: string[]; width: number; height: number; usage: Usage | undefined };

const description = 'Generate raster illustrations, transparent icons, photos, mockups, or edits of local images; '
  + 'not SVG or code-native graphics. Uses the user\'s ChatGPT subscription at no API cost. Output is about '
  + '1.57 megapixels: state the aspect ratio in the prompt (e.g. "16:9 landscape"). Pixel sizes in the prompt are '
  + 'not honored; resize afterwards for exact pixels. Pass reference_image_paths to edit or match existing images. '
  + 'Generation takes 15-120 seconds. Saves a PNG (extra images as name-2.png, name-3.png) and returns the first '
  + 'image for inspection.';

/** Pi validates model calls against the schema; direct programmatic callers get the same rules here. */
function validateParams(params: ImageParams): void {
  if (!params || typeof params.prompt !== 'string' || !params.prompt.trim()) {
    throw new Error('A non-empty image prompt is required.');
  }
  if (typeof params.output_path !== 'string' || !/\.png$/i.test(params.output_path) || params.output_path.includes('\0')) {
    throw new Error('output_path must end in .png.');
  }
  for (const key of ['overwrite', 'transparent'] as const) {
    if (params[key] !== undefined && typeof params[key] !== 'boolean') throw new Error(`${key} must be a boolean.`);
  }
  // Only undefined means "no references"; Pi strips model-sent nulls, so a null here is a caller bug.
  const references = params.reference_image_paths === undefined ? [] : params.reference_image_paths;
  if (!Array.isArray(references) || references.length > MAX_REFERENCES) {
    throw new Error(`Provide at most ${MAX_REFERENCES} reference images.`);
  }
  if (references.some((value) => typeof value !== 'string' || !value.trim() || value.includes('\0'))) {
    throw new Error('Reference image paths must be non-empty strings.');
  }
}

/** File extensions are untrusted; references must have a supported image signature. */
function imageMimeType(data: Buffer): string | undefined {
  if (data.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  const header = data.toString('latin1', 0, 12);
  if (header.startsWith('GIF87a') || header.startsWith('GIF89a')) return 'image/gif';
  if (header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP') return 'image/webp';
  return undefined;
}

/** Measure and read through one handle so a path swapped mid-way cannot change which file is used. */
async function loadReference(cwd: string, reference: string, signal?: AbortSignal): Promise<ImageContent> {
  const referencePath = path.resolve(cwd, reference);
  // O_NONBLOCK keeps a FIFO at this path from hanging the open; regular files are unaffected.
  const handle = await fs.open(referencePath, fsConstants.O_RDONLY | fsConstants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error(`Reference image is not a regular file: ${referencePath}`);
    if (stat.size > MAX_REFERENCE_BYTES) throw new Error(`Reference image exceeds 20 MB: ${referencePath}`);
    const data = await handle.readFile({ signal });
    // The file can still grow while it is read.
    if (data.length > MAX_REFERENCE_BYTES) throw new Error(`Reference image exceeds 20 MB: ${referencePath}`);
    const mimeType = imageMimeType(data);
    if (!mimeType) throw new Error(`Unsupported reference image type (expected PNG, JPEG, WebP or GIF): ${referencePath}`);
    return { type: 'image', data: data.toString('base64'), mimeType };
  } finally {
    await handle.close();
  }
}

/** The backend always returns PNG; reject malformed headers before anything is written. */
function decodePng(image: ImageContent): DecodedPng {
  const data = Buffer.from(image.data, 'base64');
  if (data.length < 33 || !data.subarray(0, 8).equals(PNG_SIGNATURE) ||
    data.readUInt32BE(8) !== 13 || data.toString('latin1', 12, 16) !== 'IHDR' ||
    !data.readUInt32BE(16) || !data.readUInt32BE(20)) {
    throw new Error('Image generation returned an invalid PNG IHDR header.');
  }
  return { data, width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

/** Fail early, before generating, when a destination cannot be written under the overwrite rule. */
async function checkOutput(filePath: string, overwrite: boolean): Promise<void> {
  let stat;
  try {
    stat = await fs.lstat(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  if (!overwrite) throw new Error(`File already exists: ${filePath}. Set overwrite to true to replace it.`);
  // Reject existing symlinks to avoid accidentally writing a different destination.
  if (!stat.isFile()) throw new Error(`Output path is not a regular file: ${filePath}`);
}

/** Hard links are unavailable on FAT/exFAT and some FUSE/SMB mounts; COPYFILE_EXCL still refuses existing names. */
async function publishNew(temp: string, filePath: string): Promise<void> {
  try {
    await fs.link(temp, filePath);
  } catch (error) {
    if (!['EPERM', 'ENOTSUP', 'ENOSYS'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
    await fs.copyFile(temp, filePath, fsConstants.COPYFILE_EXCL);
  }
}

/**
 * Stage every image in a new same-directory temp file, then publish. `rename` (overwrite) and
 * `link`/`COPYFILE_EXCL` (no overwrite) act on the destination entry itself, so a symlink swapped
 * in after checkOutput is replaced or refused, never followed. Any failure while staging, including
 * an abort, leaves every destination untouched. Like any atomic save, overwrite replaces the file
 * rather than its contents: the old mode, owner and other hard links are not carried over.
 */
export async function saveImages(paths: string[], images: Buffer[], overwrite: boolean, signal?: AbortSignal): Promise<void> {
  const staged: string[] = [];
  const published: string[] = [];
  try {
    for (const [index, filePath] of paths.entries()) {
      signal?.throwIfAborted();
      // Fixed-length name, so a destination name near the 255-byte limit cannot overflow it.
      const temp = path.join(path.dirname(filePath), `.generate-image-${randomUUID()}.tmp`);
      // Push before writing so a partial temp file is still cleaned up.
      staged.push(temp);
      // 'wx' only ever creates a new file; it fails instead of following anything at this name.
      await fs.writeFile(temp, images[index], { flag: 'wx', signal });
    }
    signal?.throwIfAborted();
    // Publishing is a few metadata operations, so it runs to completion once started.
    for (const [index, filePath] of paths.entries()) {
      if (overwrite) await fs.rename(staged[index], filePath);
      else await publishNew(staged[index], filePath);
      published.push(filePath);
    }
  } catch (error) {
    if (!overwrite) {
      // These files did not exist before this call, so removing them restores the prior state.
      // allSettled: a cleanup failure must not hide the error that caused the rollback.
      await Promise.allSettled(published.map((filePath) => fs.rm(filePath, { force: true })));
      throw error;
    }
    // Replaced originals cannot be restored; say exactly which destinations changed.
    if (published.length) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${message} Already saved before the failure: ${published.join(', ')}`);
    }
    throw error;
  } finally {
    // allSettled: a stray temp file must not turn a completed save into a reported failure.
    await Promise.allSettled(staged.map((temp) => fs.rm(temp, { force: true })));
  }
}

/** Inject generation for offline tests; production reuses the provider's HTTP and auth handling. */
export function createGenerateImageTool(generateImages?: ProviderImages['generateImages']): ToolDefinition<any, ImageDetails> {
  return {
    name: 'generate_image',
    label: 'Generate image',
    description,
    promptSnippet: 'Generate or edit PNG images with the ChatGPT subscription; state the aspect ratio in the prompt.',
    parameters,
    async execute(_toolCallId, params: ImageParams, signal, _onUpdate, ctx) {
      // Validate and preflight before reading references or spending subscription quota.
      validateParams(params);
      signal?.throwIfAborted();
      const outputPath = path.resolve(ctx.cwd, params.output_path);
      const overwrite = params.overwrite ?? false;
      await checkOutput(outputPath, overwrite);
      const input: ImagesContext['input'] = [{ type: 'text', text: params.prompt }];
      for (const reference of params.reference_image_paths ?? []) input.push(await loadReference(ctx.cwd, reference, signal));

      const model: ImageModel<'codex-images'> = {
        type: 'image', provider: 'codex-images', api: 'codex-images',
        id: params.transparent ? 'chatgpt-images-transparent' : 'chatgpt-images',
        name: 'ChatGPT Images via Codex', baseUrl: BASE_URL,
        input: ['text', 'image'], output: ['image'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      };
      const generate = generateImages ?? createGenerateImages(
        (url, init) => fetch(url, init),
        // Tool contexts are session-bound; resolve on every call so OAuth refreshes apply.
        () => ctx.modelRegistry.getApiKeyForProvider('openai-codex'),
      );
      signal?.throwIfAborted();
      const result = await generate(model, { input }, { signal });
      if (result.stopReason !== 'stop') throw new Error(result.errorMessage ?? 'Image generation failed.');
      signal?.throwIfAborted();

      const blocks = result.output.filter((block): block is ImageContent => block.type === 'image');
      if (!blocks.length) throw new Error('Image generation returned no images.');
      const images = blocks.map(decodePng);
      const paths = images.map((_image, index) => index === 0 ? outputPath : `${outputPath.slice(0, -4)}-${index + 1}.png`);
      // Extras are only known after generation, and files can appear while it runs: check them all again.
      for (const filePath of paths) await checkOutput(filePath, overwrite);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await saveImages(paths, images.map((image) => image.data), overwrite, signal);

      const saved = paths.map((filePath, index) => `${filePath} (${images[index].width}×${images[index].height} pixels)`);
      return {
        content: [
          { type: 'text', text: `Saved: ${saved.join(', ')}. Output is ~1.57 MP; only the aspect ratio follows the prompt. Resize afterwards for exact pixels.` },
          blocks[0],
        ],
        details: { paths, width: images[0].width, height: images[0].height, usage: result.usage },
        usage: result.usage,
      };
    },
  };
}
