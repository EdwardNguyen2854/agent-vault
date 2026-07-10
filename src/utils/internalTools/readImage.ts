import type {
  InternalToolHandler,
  ToolInvocationResult,
  ToolExecutionContext,
} from '../../types';
import { cleanString } from './validation';
import {
  MAX_VISION_BYTES,
  bytesToDataUrl,
  getImageExtension,
  validateImagePath,
} from './image';

export interface VaultImageReadResult {
  path: string;
  name: string;
  mimeType: string;
  size: number;
  extension: string;
  /**
   * Vision-safe base64 data URL for callers that need to embed the image
   * inline. This is redacted in chat transcripts.
   */
  dataUrl?: string;
  /**
   * Set when the file exists but exceeds the per-image vision budget.
   * The metadata is returned but no `dataUrl` is included.
   */
  visionUnavailable?: boolean;
}

export const vaultReadImage: InternalToolHandler = {
  toolId: 'vault.read_image',
  toolName: 'Read Image',
  description:
    'Read an image file from the vault by its relative path. Returns the image metadata and a vision-safe data URL when supported. Larger images return metadata only.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description:
          'Relative path to the image file from the vault root (e.g. assets/diagram.png)',
      },
      inline: {
        type: 'boolean',
        description:
          'Whether to include a vision-safe data URL in the result (default: true). Set false for metadata only.',
      },
    },
    required: ['path'],
  },
  handler: async (input, ctx): Promise<ToolInvocationResult> => {
    const pathValidation = validateImagePath(cleanString(input.path));
    if (!pathValidation.ok || !pathValidation.normalized) {
      return { success: false, error: pathValidation.error ?? 'Invalid path.', durationMs: 0 };
    }
    const imagePath = pathValidation.normalized;

    const inlineRequested = input.inline === false ? false : true;

    const extension = getImageExtension(imagePath);
    if (!extension) {
      return {
        success: false,
        error: `Image path must include a supported file extension (.png, .jpg, .jpeg, .webp, .gif).`,
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
      const parts = imagePath.split('/').filter(Boolean);
      const fileName = parts.pop()!;
      let directory = ctx.personalRootHandle;
      for (const part of parts) {
        directory = await directory.getDirectoryHandle(part);
      }
      const fileHandle = await directory.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const mimeType =
        file.type ||
        (extension === 'jpg'
          ? 'image/jpeg'
          : `image/${extension === 'svg' ? 'svg+xml' : extension}`);

      const result: VaultImageReadResult = {
        path: imagePath,
        name: fileName,
        mimeType,
        size: file.size,
        extension,
      };

      if (!inlineRequested) {
        return { success: true, output: result, durationMs: 0 };
      }

      if (file.size > MAX_VISION_BYTES) {
        result.visionUnavailable = true;
        return {
          success: true,
          output: result,
          durationMs: 0,
        };
      }

      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      result.dataUrl = bytesToDataUrl(bytes, mimeType);
      return { success: true, output: result, durationMs: 0 };
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
