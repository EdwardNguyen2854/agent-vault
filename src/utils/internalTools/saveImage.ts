import type {
  InternalToolHandler,
  ToolInvocationResult,
  ToolExecutionContext,
} from '../../types';
import { cleanString } from './validation';
import {
  parseImageDataUrl,
  validateImageExtension,
  validateImagePath,
  validateMimeMatchesExtension,
} from './image';

export interface VaultImageSaveResult {
  markdown: string;
  path: string;
  size: number;
  mimeType: string;
  name: string;
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

    const pathValidation = validateImagePath(folder);
    if (!pathValidation.ok) {
      return { success: false, error: pathValidation.error ?? 'Invalid folder.', durationMs: 0 };
    }
    const folderNormalized = pathValidation.normalized ?? 'assets';

    const extValidation = validateImageExtension(filename);
    if (!extValidation.ok || !extValidation.extension || !extValidation.mimeType) {
      return {
        success: false,
        error: extValidation.error ?? 'Invalid image filename.',
        durationMs: 0,
      };
    }

    const parsed = parseImageDataUrl(dataUrl);
    if (!parsed.ok) {
      return { success: false, error: parsed.error ?? 'Cannot decode image payload.', durationMs: 0 };
    }
    const mimeCheck = validateMimeMatchesExtension(parsed.mimeType, extValidation.extension);
    if (!mimeCheck.ok) {
      return { success: false, error: mimeCheck.error ?? 'MIME mismatch.', durationMs: 0 };
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
      const folderParts = folderNormalized.split('/').filter(Boolean);
      const filePath = [...folderParts, filename].join('/');

      let directory = ctx.personalRootHandle;
      for (const part of folderParts) {
        directory = await directory.getDirectoryHandle(part, { create: true });
      }

      let targetHandle: FileSystemFileHandle;
      let finalPath = filePath;
      try {
        targetHandle = await directory.getFileHandle(filename);
        const dotIndex = filename.lastIndexOf('.');
        const baseName = dotIndex >= 0 ? filename.slice(0, dotIndex) : filename;
        const newName = `${baseName}_${Date.now()}.${extValidation.extension}`;
        targetHandle = await directory.getFileHandle(newName, { create: true });
        finalPath = [...folderParts, newName].join('/');
      } catch {
        targetHandle = await directory.getFileHandle(filename, { create: true });
      }

      const writable = await targetHandle.createWritable();
      const buffer = new ArrayBuffer(parsed.bytes.byteLength);
      new Uint8Array(buffer).set(parsed.bytes);
      await writable.write(new Blob([buffer], { type: parsed.mimeType }));
      await writable.close();

      const file = await targetHandle.getFile();
      const fileName = finalPath.split('/').pop() ?? 'image';

      const markdown = `![${fileName}](${finalPath})`;

      const result: VaultImageSaveResult = {
        markdown,
        path: finalPath,
        size: file.size,
        mimeType: parsed.mimeType,
        name: fileName,
      };
      return { success: true, output: result, durationMs: 0 };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: 0,
      };
    }
  },
};
