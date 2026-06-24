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
]);

const MIME_TYPE_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : '';
}

/**
 * Validate a data URL and extract the raw base64 payload and MIME type.
 */
function parseDataUrl(dataUrl: string): {
  mimeType: string;
  rawBase64: string;
  error?: string;
} {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return {
      mimeType: '',
      rawBase64: '',
      error:
        'Invalid data URL format. Expected data:<mime>;base64,<data>. Use the full data URL including the data: prefix.',
    };
  }
  return { mimeType: match[1], rawBase64: match[2] };
}

export const vaultSaveImage: InternalToolHandler = {
  toolId: 'vault.save_image',
  toolName: 'Save Image',
  description:
    'Save an image (as a base64 data URL) to the vault. Returns a markdown image link that can be inserted into a note.',
  parameters: {
    type: 'object',
    properties: {
      data_url: {
        type: 'string',
        description:
          'Full base64 data URL of the image, e.g. data:image/png;base64,iVBORw0KGgo...',
      },
      filename: {
        type: 'string',
        description:
          'Filename for the saved image, including extension (e.g. diagram.png, photo.jpg, icon.svg)',
      },
      folder: {
        type: 'string',
        description:
          'Subfolder to save the image in (e.g. assets, images). Defaults to "assets". Created automatically if it does not exist.',
      },
    },
    required: ['data_url', 'filename'],
  },
  handler: async (input, ctx): Promise<ToolInvocationResult> => {
    const dataUrl = typeof input.data_url === 'string' ? input.data_url.trim() : '';
    const filename = cleanString(input.filename);
    const folder = cleanString(input.folder) || 'assets';

    if (!dataUrl) {
      return { success: false, error: 'data_url is required', durationMs: 0 };
    }
    if (!filename) {
      return { success: false, error: 'filename is required', durationMs: 0 };
    }

    // Validate filename extension
    const ext = getExtension(filename);
    if (!ext) {
      return {
        success: false,
        error:
          'Filename must include a valid image extension (e.g. .png, .jpg, .webp)',
        durationMs: 0,
      };
    }
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      return {
        success: false,
        error: `Unsupported image extension: .${ext}. Allowed: ${Array.from(ALLOWED_IMAGE_EXTENSIONS).join(', ')}`,
        durationMs: 0,
      };
    }

    // Validate folder doesn't escape
    if (folder.includes('..')) {
      return {
        success: false,
        error: 'Folder path cannot contain path traversal',
        durationMs: 0,
      };
    }

    // Parse the data URL
    const parsed = parseDataUrl(dataUrl);
    if (parsed.error) {
      return { success: false, error: parsed.error, durationMs: 0 };
    }

    // Validate size (approximate: base64 is ~4/3 of binary size)
    const approximateSize = Math.ceil((parsed.rawBase64.length * 3) / 4);
    if (approximateSize > MAX_IMAGE_SIZE) {
      return {
        success: false,
        error: `Image data is too large (approximately ${(approximateSize / (1024 * 1024)).toFixed(1)} MB). Maximum is ${MAX_IMAGE_SIZE / (1024 * 1024)} MB.`,
        durationMs: 0,
      };
    }

    // Check MIME type matches extension
    const expectedMime = MIME_TYPE_MAP[ext];
    if (expectedMime && parsed.mimeType !== expectedMime) {
      return {
        success: false,
        error: `MIME type "${parsed.mimeType}" does not match extension ".${ext}". Expected "${expectedMime}".`,
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
    if (!ctx.personalVaultSource) {
      return {
        success: false,
        error: 'No personal vault source available',
        durationMs: 0,
      };
    }
    if (ctx.personalVaultSource.role !== 'personal' || ctx.personalVaultSource.readOnly) {
      return {
        success: false,
        error: 'Personal vault source is not writable',
        durationMs: 0,
      };
    }

    try {
      // Create target directory path
      const folderParts = folder.split('/').filter(Boolean);
      const filePath = [...folderParts, filename].join('/');

      // Create directory if needed
      let directory = ctx.personalRootHandle;
      for (const part of folderParts) {
        directory = await directory.getDirectoryHandle(part, { create: true });
      }

      // Check if file already exists
      let targetHandle: FileSystemFileHandle;
      let finalPath = filePath;
      try {
        targetHandle = await directory.getFileHandle(filename);
        // File exists — append timestamp to make unique
        const dotIndex = filename.lastIndexOf('.');
        const baseName = dotIndex >= 0 ? filename.slice(0, dotIndex) : filename;
        const newName = `${baseName}_${Date.now()}.${ext}`;
        targetHandle = await directory.getFileHandle(newName, { create: true });
        finalPath = [...folderParts, newName].join('/');
      } catch {
        // File doesn't exist — create it
        targetHandle = await directory.getFileHandle(filename, { create: true });
      }

      // Convert base64 to binary
      const binaryStr = atob(parsed.rawBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const writable = await targetHandle.createWritable();
      await writable.write(bytes);
      await writable.close();

      const file = await targetHandle.getFile();
      const fileName = finalPath.split('/').pop() ?? 'image';

      // Build markdown image reference
      const markdown = `![${fileName}](${finalPath})`;

      return {
        success: true,
        output: {
          markdown,
          path: finalPath,
          size: file.size,
          mime_type: parsed.mimeType,
          name: fileName,
        },
        durationMs: 0,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: 0,
      };
    }
  },
};
