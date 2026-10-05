import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { BASE_URL, createGenerateImages } from './codex-images.ts';
import { createGenerateImageTool } from './generate-image-tool.ts';

/** Register separately so image models never replace the user's Codex chat catalog. */
export default function (pi: ExtensionAPI) {
  // Tools belong to each extension instance; their execute context supplies the bound session.
  pi.registerTool(createGenerateImageTool());

  // Register per bound session, not at load. Pi applies load-time registrations when a session is
  // constructed, and pi-subagents' mention clones share the parent's ModelRuntime without ever
  // firing session_start. A load-time registration from such a clone would replace the parent's
  // working provider with one that has no registry. Registering here means every registration
  // carries a live registry. Do not unregister on shutdown: provider ids are not owned per
  // extension, so a child's shutdown would remove the parent's provider.
  pi.on('session_start', (_event, ctx) => {
    const modelRegistry = ctx.modelRegistry;
    pi.registerProvider('codex-images', {
      // No provider-level `api`: Pi applies it only to chat models, so each image model sets its own.
      baseUrl: BASE_URL,
      // ModelRuntime checks this provider's auth before dispatch. This is NOT sent to Codex.
      apiKey: 'codex-subscription-credential-resolved-at-request-time',
      images: {
        'codex-images': {
          generateImages: createGenerateImages(
            (url, init) => fetch(url, init),
            // Resolve per request so Pi refreshes the Codex OAuth token when it nears expiry.
            () => modelRegistry.getApiKeyForProvider('openai-codex'),
          ),
        },
      },
      models: [
        {
          type: 'image',
          id: 'chatgpt-images',
          api: 'codex-images',
          // Live tests: output is always ~1.57 MP; only the aspect ratio follows the prompt.
          name: 'ChatGPT Images via Codex (~1.57 MP; state the aspect ratio in the prompt)',
          input: ['text', 'image'],
          output: ['image'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        },
        {
          type: 'image',
          id: 'chatgpt-images-transparent',
          api: 'codex-images',
          name: 'ChatGPT Images via Codex, transparent (~1.57 MP; state the aspect ratio in the prompt)',
          input: ['text', 'image'],
          output: ['image'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        },
      ],
    });
  });
}
