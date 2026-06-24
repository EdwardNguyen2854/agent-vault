import type { VaultFolder } from '../types';

/**
 * Manifest stored as `.meta/tags.json` inside each vault.
 *
 * ─ vault  – tags attached to the vault itself
 * ─ folders – tags per folder path (relative to vault root)
 * ─ files   – tags per non-note file path (relative to vault root)
 */
export interface EntityTagsManifest {
  vault: string[];
  folders: Record<string, string[]>;
  files: Record<string, string[]>;
}

/** A single entity that carries tags, used for display in TagsView. */
export interface TaggedEntity {
  type: 'vault' | 'folder' | 'file';
  id: string;
  name: string;
  tags: string[];
}

const META_DIR = '.meta';
const TAGS_FILE = 'tags.json';

/** Return a blank manifest. */
export function emptyManifest(): EntityTagsManifest {
  return { vault: [], folders: {}, files: {} };
}

/**
 * Read `.meta/tags.json` from a vault root handle.
 * Returns an empty manifest if the file does not exist or cannot be parsed.
 */
export async function loadEntityTags(
  rootHandle: FileSystemDirectoryHandle,
): Promise<EntityTagsManifest> {
  try {
    const metaDir = await rootHandle.getDirectoryHandle(META_DIR);
    const fileHandle = await metaDir.getFileHandle(TAGS_FILE);
    const file = await fileHandle.getFile();
    const text = await file.text();
    const data = JSON.parse(text) as Partial<EntityTagsManifest>;
    return {
      vault: Array.isArray(data.vault) ? data.vault : [],
      folders: data.folders ?? {},
      files: data.files ?? {},
    };
  } catch {
    return emptyManifest();
  }
}

/**
 * Write `.meta/tags.json` to a vault root handle.
 * Creates the `.meta` directory and file if they don't exist.
 */
export async function saveEntityTags(
  rootHandle: FileSystemDirectoryHandle,
  manifest: EntityTagsManifest,
): Promise<void> {
  const metaDir = await rootHandle.getDirectoryHandle(META_DIR, { create: true });
  const fileHandle = await metaDir.getFileHandle(TAGS_FILE, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(manifest, null, 2));
  await writable.close();
}

/**
 * Merge folder tags from a per-vault manifest map into a `VaultFolder[]`.
 * Returns a new array with tags populated where the manifest has entries.
 */
export function applyFolderTags(
  folders: VaultFolder[],
  manifests: Map<string, EntityTagsManifest>,
): VaultFolder[] {
  return folders.map((folder) => {
    const manifest = manifests.get(folder.vaultId);
    if (!manifest) return folder;
    const folderTags = manifest.folders[folder.path];
    if (folderTags && folderTags.length > 0) {
      return { ...folder, tags: folderTags };
    }
    return folder;
  });
}

/** Build a list of `TaggedEntity` for vault-level tags from all manifests. */
export function getVaultTaggedEntities(
  manifests: Map<string, EntityTagsManifest>,
): TaggedEntity[] {
  const result: TaggedEntity[] = [];
  for (const [vaultId, manifest] of manifests) {
    if (manifest.vault.length > 0) {
      result.push({
        type: 'vault',
        id: vaultId,
        name: vaultId,
        tags: manifest.vault,
      });
    }
  }
  return result;
}

/** Build a list of `TaggedEntity` for file-level tags from all manifests. */
export function getFileTaggedEntities(
  manifests: Map<string, EntityTagsManifest>,
): TaggedEntity[] {
  const result: TaggedEntity[] = [];
  for (const [vaultId, manifest] of manifests) {
    for (const [path, tags] of Object.entries(manifest.files)) {
      if (tags.length > 0) {
        result.push({
          type: 'file',
          id: `${vaultId}:${path}`,
          name: path,
          tags,
        });
      }
    }
  }
  return result;
}
