import type {
  InternalToolHandler,
  ToolInvocationResult,
  ToolExecutionContext,
} from '../../types';
import { cleanString } from './validation';

const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20 MB

const ALLOWED_IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'svg',
  'bmp',
  'ico',
]);

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : '';
}

export const vaultReadImage: InternalToolHandler = {
  toolId: 'vault.read_image',
  toolName: 'Read Image',
  description:
    'Read an image file from the vault by its relative path. Returns the image as a data URL.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description:
          'Relative path to the image file from the vault root (e.g. assets/diagram.png)',
      },
    },
    required: ['path'],
  },
  handler: async (input, ctx): Promise<ToolInvocationResult> => {
    const imagePath = cleanString(input.path);
    if (!imagePath) return { success: false, error: 'path is required', durationMs: 0 };

    if (imagePath.includes('..')) {
      return { success: false, error: 'Path traversal is not allowed', durationMs: 0 };
    }

    const ext = getExtension(imagePath);
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      return {
        success: false,
        error: `Unsupported image extension: .${ext}. Allowed: ${Array.from(ALLOWED_IMAGE_EXTENSIONS).join(', ')}`,
        durationMs: 0,
      };
    }

    if (!ctx.personalRootHandle) {
      return {
        success: false,
        error:
          'No personal vault root handle available. Open a writable personal vault first.',
        durationMs: 0,
      };
    }

    try {
      // Walk directory tree to find the file
      const parts = imagePath.split('/').filter(Boolean);
      const fileName = parts.pop()!;
      let directory = ctx.personalRootHandle;

      for (const part of parts) {
        directory = await directory.getDirectoryHandle(part);
      }

      const fileHandle = await directory.getFileHandle(fileName);
      const file = await fileHandle.getFile();

      if (file.size > MAX_IMAGE_SIZE) {
        return {
          success: false,
          error: `Image is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum is ${MAX_IMAGE_SIZE / (1024 * 1024)} MB.`,
          durationMs: 0,
        };
      }

      // Read as data URL
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          typeof reader.result === 'string'
            ? resolve(reader.result)
            : reject(new Error('Could not read image as data URL'));
        reader.onerror = () =>
          reject(reader.error ?? new Error('Unknown error reading image'));
        reader.readAsDataURL(file);
      });

      return {
        success: true,
        output: {
          data_url: dataUrl,
          mime_type: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          size: file.size,
          name: fileName,
          path: imagePath,
        },
        durationMs: 0,
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotFoundError') {
        return {
          success: false,
          error: `Image not found at path: ${imagePath}`,
          durationMs: 0,
        };
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: 0,
      };
    }
  },
};
