import type { VaultFile, VaultFolder, VaultNote } from '../types';
import { parseNoteContent } from './markdown';
import { normalizeVaultPath } from './paths';

const markdownExtensions = new Set(['md', 'markdown']);
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', '.obsidian']);

export interface VaultSource {
  id: string;
  name: string;
  role: 'agent' | 'personal' | 'shared';
  readOnly: boolean;
}

export const agentVaultSource: VaultSource = {
  id: 'agent-vault',
  name: 'Agent Vault',
  role: 'agent',
  readOnly: true,
};

/**
 * Filenames that act as folder note files inside an agent vault.
 * For agent vault types, SOUL.md, SKILLS.md, TOOLS.md, and AGENTS.md are the
 * canonical folder note files that describe the folder they live in.
 * Detected anywhere in the imported folder tree (case-insensitive).
 */
export const AGENT_FOLDER_NOTE_FILENAMES = [
  'SOUL.md',
  'SKILLS.md',
  'TOOLS.md',
  'AGENTS.md',
] as const;
export type AgentFolderNoteFilename = (typeof AGENT_FOLDER_NOTE_FILENAMES)[number];

export interface DetectedAgentFolderNote {
  filename: AgentFolderNoteFilename;
  path: string;
}

/**
 * Walks a set of notes and returns the entries whose filename matches one of
 * the known agent folder note filenames. Detection is case-insensitive and
 * works for files at any depth in the vault tree.
 */
export function findAgentFolderNoteFiles(notes: VaultNote[]): DetectedAgentFolderNote[] {
  const allowed = new Set<string>(AGENT_FOLDER_NOTE_FILENAMES.map((name) => name.toLowerCase()));
  const found: DetectedAgentFolderNote[] = [];
  for (const note of notes) {
    const lastSlash = note.path.lastIndexOf('/');
    const basename = lastSlash >= 0 ? note.path.slice(lastSlash + 1) : note.path;
    const lower = basename.toLowerCase();
    if (allowed.has(lower)) {
      found.push({
        filename: basename.toUpperCase().replace(/\.MD$/, '.md') as AgentFolderNoteFilename,
        path: note.path,
      });
    }
  }
  return found.sort((a, b) => a.path.localeCompare(b.path));
}

export interface StarterVaultTemplate {
  id: string;
  name: string;
  description: string;
  recommendedRole: 'personal' | 'shared' | 'agent';
  fileCount: number;
}

interface StarterVaultFile {
  templateId: string;
  path: string;
  content: string;
}

interface PreparedStarterFile {
  path: string;
  content: string;
}

export function canWriteVaultNote(note?: VaultNote | null): boolean {
  return Boolean(note && note.vaultRole === 'personal' && !note.readOnly);
}

export function deriveVaultFolders(notes: VaultNote[], sources: VaultSource[] = []): VaultFolder[] {
  const folders = new Map<string, VaultFolder>();

  for (const source of sources) {
    folders.set(`${source.id}:`, {
      vaultId: source.id,
      vaultName: source.name,
      vaultRole: source.role,
      readOnly: source.readOnly,
      path: '',
    });
  }

  for (const note of notes) {
    const source = {
      vaultId: note.vaultId,
      vaultName: note.vaultName,
      vaultRole: note.vaultRole,
      readOnly: note.readOnly,
    };
    folders.set(`${note.vaultId}:`, { ...source, path: '' });

    const parts = note.path.split('/').filter(Boolean);
    for (let i = 0; i < parts.length - 1; i++) {
      const path = parts.slice(0, i + 1).join('/');
      folders.set(`${note.vaultId}:${path.toLowerCase()}`, {
        ...source,
        path,
      });
    }
  }

  return Array.from(folders.values())
    .filter((folder) => folder.path)
    .sort((a, b) => a.vaultName.localeCompare(b.vaultName) || a.path.localeCompare(b.path));
}

export function getPinnedRank(path: string): number {
  const basename = path.split('/').pop()?.toLowerCase() ?? '';
  if (basename === 'home.md') return 0;
  if (basename === 'user.md') return 1;
  if (basename === 'memory.md') return 2;
  return -1;
}

export function compareVaultPaths(a: string, b: string): number {
  const aRank = getPinnedRank(a);
  const bRank = getPinnedRank(b);
  if (aRank >= 0 && bRank >= 0) return aRank - bRank;
  if (aRank >= 0) return -1;
  if (bRank >= 0) return 1;
  return a.localeCompare(b);
}

export function getExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function isMarkdownFile(name: string): boolean {
  return markdownExtensions.has(getExtension(name));
}

export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  readWrite = true,
): Promise<boolean> {
  const options = { mode: readWrite ? 'readwrite' : 'read' } as const;
  if (handle.queryPermission && (await handle.queryPermission(options)) === 'granted') return true;
  if (handle.requestPermission && (await handle.requestPermission(options)) === 'granted')
    return true;
  return !handle.queryPermission && !handle.requestPermission;
}

export async function queryReadPermission(
  handle: FileSystemDirectoryHandle,
): Promise<'granted' | 'prompt' | 'denied'> {
  if (!handle.queryPermission) return 'granted';
  try {
    return await handle.queryPermission({ mode: 'read' });
  } catch {
    return 'denied';
  }
}

export async function queryWritePermission(
  handle: FileSystemDirectoryHandle,
): Promise<'granted' | 'prompt' | 'denied'> {
  if (!handle.queryPermission) return 'granted';
  try {
    return await handle.queryPermission({ mode: 'readwrite' });
  } catch {
    return 'denied';
  }
}

export async function scanDirectory(
  handle: FileSystemDirectoryHandle,
  source: VaultSource,
  basePath = '',
): Promise<VaultFile[]> {
  const files: VaultFile[] = [];

  for await (const [name, child] of handle.entries()) {
    if (child.kind === 'directory') {
      if (ignoredDirectories.has(name) || name.startsWith('.')) continue;
      const childFiles = await scanDirectory(
        child as FileSystemDirectoryHandle,
        source,
        basePath ? `${basePath}/${name}` : name,
      );
      files.push(...childFiles);
      continue;
    }

    if (child.kind === 'file' && isMarkdownFile(name)) {
      const fileHandle = child as FileSystemFileHandle;
      const file = await fileHandle.getFile();
      files.push({
        vaultId: source.id,
        vaultName: source.name,
        vaultRole: source.role,
        readOnly: source.readOnly,
        path: basePath ? `${basePath}/${name}` : name,
        name,
        extension: getExtension(name),
        handle: fileHandle,
        updatedAt: file.lastModified,
        size: file.size,
      });
    }
  }

  return files.sort((a, b) => compareVaultPaths(a.path, b.path));
}

export async function loadNotes(
  rootHandle: FileSystemDirectoryHandle,
  source: VaultSource,
): Promise<VaultNote[]> {
  const files = await scanDirectory(rootHandle, source);
  const notes = await Promise.all(
    files.map(async (file) => {
      const blob = await file.handle.getFile();
      const content = await blob.text();
      return parseNoteContent({ ...file, content });
    }),
  );
  return notes;
}

export async function writeNote(note: VaultNote, content: string): Promise<VaultNote> {
  const writable = await note.handle.createWritable();
  await writable.write(content);
  await writable.close();
  const updatedFile = await note.handle.getFile();
  return parseNoteContent({
    ...note,
    content,
    updatedAt: updatedFile.lastModified,
    size: updatedFile.size,
  });
}

/**
 * Walks down the directory tree, creating directories as needed.
 */
export async function getDirectoryHandleByPath(
  rootHandle: FileSystemDirectoryHandle,
  parts: string[],
  options?: { create?: boolean },
): Promise<FileSystemDirectoryHandle> {
  let current = rootHandle;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create: options?.create ?? false });
  }
  return current;
}

/**
 * Splits a path into directory parts and filename, then returns the file handle.
 * Does NOT create the file by default.
 */
export async function getFileHandleByPath(
  rootHandle: FileSystemDirectoryHandle,
  path: string,
  options?: { create?: boolean },
): Promise<{
  directory: FileSystemDirectoryHandle;
  fileName: string;
  fileHandle: FileSystemFileHandle;
}> {
  const normalized = normalizeVaultPath(path);
  const parts = normalized.split('/').filter(Boolean);
  const fileName = parts.pop() ?? 'Untitled.md';
  const directory = await getDirectoryHandleByPath(rootHandle, parts, options);
  const fileHandle = await directory.getFileHandle(fileName, { create: options?.create ?? false });
  return { directory, fileName, fileHandle };
}

export async function createDirectory(
  rootHandle: FileSystemDirectoryHandle,
  path: string,
): Promise<void> {
  const parts = path
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  await getDirectoryHandleByPath(rootHandle, parts, { create: true });
}

export async function deleteDirectory(
  rootHandle: FileSystemDirectoryHandle,
  path: string,
): Promise<void> {
  const parts = path
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  const directoryName = parts.pop();
  if (!directoryName) throw new Error('Cannot delete vault root');
  const parent = await getDirectoryHandleByPath(rootHandle, parts);
  await parent.removeEntry(directoryName, { recursive: true });
}

/**
 * Creates a new note at the specified path.
 * Throws an error if the file already exists (by default).
 */
export async function createNote(
  rootHandle: FileSystemDirectoryHandle,
  source: VaultSource,
  name: string,
  initialContent = '',
  options?: { create?: boolean },
): Promise<VaultNote> {
  const normalized = normalizeVaultPath(name);
  const parts = normalized.split('/').filter(Boolean);
  const fileName = parts.pop() ?? 'Untitled.md';

  let directory = rootHandle;
  for (const part of parts) {
    directory = await directory.getDirectoryHandle(part, { create: true });
  }

  // Check if file already exists
  try {
    await directory.getFileHandle(fileName);
    throw new Error('Path already exists');
  } catch (error) {
    if (error instanceof Error && error.message === 'Path already exists') throw error;
    // Expected when file doesn't exist
  }

  const fileHandle = await directory.getFileHandle(fileName, { create: true });
  const title = fileName.replace(/\.md$/i, '').replace(/[-_]+/g, ' ');
  const writable = await fileHandle.createWritable();
  await writable.write(initialContent || `# ${title}\n\n`);
  await writable.close();
  const file = await fileHandle.getFile();
  const content = await file.text();
  return parseNoteContent({
    vaultId: source.id,
    vaultName: source.name,
    vaultRole: source.role,
    readOnly: source.readOnly,
    path: normalized,
    name: fileName,
    extension: getExtension(fileName),
    handle: fileHandle,
    updatedAt: file.lastModified,
    size: file.size,
    content,
  });
}

/**
 * Renames a note by copying content to the new path and deleting the old file.
 * Uses copy-then-delete to preserve content on failure.
 */
export async function renameNote(
  rootHandle: FileSystemDirectoryHandle,
  note: VaultNote,
  nextPath: string,
): Promise<VaultNote> {
  const nextNormalized = normalizeVaultPath(nextPath);

  // Get the new file handle and directory
  const {
    directory: newDir,
    fileName: newFileName,
    fileHandle: newFileHandle,
  } = await getFileHandleByPath(rootHandle, nextNormalized, { create: true });

  // Check if the target already exists (and is not the same file)
  try {
    const existingFile = await newDir.getFileHandle(newFileName);
    const existingMeta = await existingFile.getFile();
    const noteMeta = await note.handle.getFile();
    if (
      existingMeta.lastModified !== noteMeta.lastModified ||
      existingMeta.size !== noteMeta.size
    ) {
      throw new Error('Path already exists');
    }
  } catch (err) {
    if ((err as Error).message === 'Path already exists') throw err;
    // File doesn't exist, which is fine
  }

  // Copy content to new file
  const blob = await note.handle.getFile();
  const content = await blob.text();
  const writable = await newFileHandle.createWritable();
  await writable.write(content);
  await writable.close();
  const newFile = await newFileHandle.getFile();

  // Delete the old file via parent directory
  const oldDirParts = note.path.split('/').filter(Boolean);
  const oldFileName = oldDirParts.pop() ?? note.name;
  const oldDir = await getDirectoryHandleByPath(rootHandle, oldDirParts);
  await oldDir.removeEntry(oldFileName);

  return parseNoteContent({
    vaultId: note.vaultId,
    vaultName: note.vaultName,
    vaultRole: note.vaultRole,
    readOnly: note.readOnly,
    path: nextNormalized,
    name: newFileName,
    extension: getExtension(newFileName),
    handle: newFileHandle,
    updatedAt: newFile.lastModified,
    size: newFile.size,
    content,
  });
}

/**
 * Deletes a note by removing it via the parent directory's removeEntry.
 */
export async function deleteNote(
  rootHandle: FileSystemDirectoryHandle,
  note: VaultNote,
): Promise<void> {
  const parts = note.path.split('/').filter(Boolean);
  const fileName = parts.pop() ?? note.name;
  const directory = await getDirectoryHandleByPath(rootHandle, parts);
  await directory.removeEntry(fileName);
}

function getStarterVaultFiles(): StarterVaultFile[] {
  const modules = import.meta.glob(['../../starter-vaults/**/*.md', '../../starter-kit/**/*.md'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>;
  const rawFiles = Object.entries(modules)
    .filter(([path]) => !path.endsWith('/README.md'))
    .map(([path, content]) => {
      const cleanPath = path.replace('../../starter-vaults/', '').replace('../../starter-kit/', '');
      const [templateId, ...parts] = cleanPath.split('/');
      return {
        templateId,
        path: parts.join('/'),
        content,
      };
    })
    .filter((file) => file.templateId && file.path)
    .filter((file, _index, files) => {
      if (!file.templateId.toLowerCase().endsWith('.md')) return true;
      const baseTemplateId = file.templateId.replace(/\.md$/i, '');
      return !files.some((candidate) => candidate.templateId === baseTemplateId);
    });
  return rawFiles.sort(
    (a, b) => a.templateId.localeCompare(b.templateId) || compareVaultPaths(a.path, b.path),
  );
}

export function getStarterVaultTemplates(): StarterVaultTemplate[] {
  const files = getStarterVaultFiles();
  const counts = new Map<string, number>();
  files.forEach((file) => counts.set(file.templateId, (counts.get(file.templateId) ?? 0) + 1));
  return Array.from(counts.entries())
    .map(([name, fileCount]) => ({
      id: name,
      name,
      description: getStarterVaultDescription(name),
      recommendedRole: getStarterVaultRole(name),
      fileCount,
    }))
    .sort(
      (a, b) =>
        getStarterVaultSort(a.name) - getStarterVaultSort(b.name) || a.name.localeCompare(b.name),
    );
}

function getStarterVaultSort(name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes('agent')) return 0;
  if (lower.includes('personal')) return 1;
  if (lower.includes('research')) return 2;
  if (lower.includes('team')) return 3;
  if (lower.includes('department')) return 4;
  if (lower.includes('project')) return 5;
  return 10;
}

function getStarterVaultRole(name: string): 'personal' | 'shared' | 'agent' {
  const lower = name.toLowerCase();
  if (lower.includes('personal')) return 'personal';
  if (lower.includes('agent')) return 'agent';
  if (lower.includes('department') || lower.includes('project')) return 'shared';
  return 'shared';
}

function getStarterVaultDescription(name: string): string {
  if (name.toLowerCase().includes('agent'))
    return 'A reference vault for agent profiles, shared user context, skills, tools, and launch-ready agent workflows.';
  if (name.toLowerCase().includes('personal'))
    return 'A writable home base for notes, projects, journal reviews, prompt libraries, agents, skills, tools, and memory.';
  if (name.toLowerCase().includes('research'))
    return 'A read-only reference vault for shared research, source logs, and research agents.';
  if (name.toLowerCase().includes('team'))
    return 'A shared team workspace with decision logs, working agreements, and coordination agents.';
  if (name.toLowerCase().includes('department'))
    return 'A shared workspace for department-level notes, team coordination, and cross-project resources.';
  if (name.toLowerCase().includes('project'))
    return 'A shared workspace for project goals, tasks, timelines, and notes.';
  return 'A bundled starter folder that can be copied into a local vault.';
}

export async function writeStarterVault(
  rootHandle: FileSystemDirectoryHandle,
  templateId: string,
  options: { overwrite?: boolean; targetPrefix?: string; prefixLinks?: boolean } = {},
): Promise<number> {
  const files = prepareStarterVaultFiles(templateId, options);
  if (!files.length) throw new Error('Starter vault template not found');
  await assertStarterTargetsAvailable(rootHandle, files, options);
  await writePreparedStarterFiles(rootHandle, files);
  return files.length;
}

function prepareStarterVaultFiles(
  templateId: string,
  options: { overwrite?: boolean; targetPrefix?: string; prefixLinks?: boolean } = {},
): PreparedStarterFile[] {
  const files = getStarterVaultFiles().filter((file) => file.templateId === templateId);
  const targetPrefix = options.targetPrefix ? normalizeStarterFolderPath(options.targetPrefix) : '';
  const linkTargets =
    options.prefixLinks && targetPrefix ? buildStarterLinkTargets(files, targetPrefix) : null;
  return files.map((file) => {
    const path = normalizeVaultPath(targetPrefix ? `${targetPrefix}/${file.path}` : file.path);
    return {
      path,
      content: linkTargets ? prefixStarterLinks(file.content, linkTargets) : file.content,
    };
  });
}

async function assertStarterTargetsAvailable(
  rootHandle: FileSystemDirectoryHandle,
  files: PreparedStarterFile[],
  options: { overwrite?: boolean } = {},
): Promise<void> {
  const paths = new Set<string>();
  for (const file of files) {
    const key = file.path.toLowerCase();
    if (paths.has(key)) throw new Error(`Duplicate starter path: ${file.path}`);
    paths.add(key);
  }

  if (!options.overwrite) {
    for (const file of files) {
      try {
        await getFileHandleByPath(rootHandle, file.path);
        throw new Error(`Path already exists: ${file.path}`);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Path already exists:')) throw error;
        if (error instanceof DOMException && error.name === 'NotFoundError') continue;
        throw error;
      }
    }
  }
}

async function writePreparedStarterFiles(
  rootHandle: FileSystemDirectoryHandle,
  files: PreparedStarterFile[],
): Promise<void> {
  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) continue;
    const directory = await getDirectoryHandleByPath(rootHandle, parts, { create: true });
    const fileHandle = await directory.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file.content);
    await writable.close();
  }
}

function buildStarterLinkTargets(
  files: StarterVaultFile[],
  targetPrefix: string,
): Map<string, string> {
  const targets = new Map<string, string>();
  for (const file of files) {
    const pathNoExt = file.path.replace(/\.md$/i, '');
    const title = getTitleFromMarkdown(file.content) || pathNoExt.split('/').pop() || pathNoExt;
    const prefixedPath = `${targetPrefix}/${pathNoExt}`;
    [pathNoExt, pathNoExt.split('/').pop() || pathNoExt, title].forEach((key) => {
      targets.set(normalizeStarterLinkKey(key), prefixedPath);
    });
  }
  return targets;
}

function prefixStarterLinks(content: string, targets: Map<string, string>): string {
  return content.replace(
    /\[\[([^\]|#]+)(#[^\]|]+)?(\|[^\]]+)?\]\]/g,
    (match, target: string, heading = '', alias = '') => {
      const prefixed = targets.get(normalizeStarterLinkKey(target));
      if (!prefixed) return match;
      return `[[${prefixed}${heading}${alias}]]`;
    },
  );
}

function normalizeStarterLinkKey(input: string): string {
  return input.trim().replace(/\.md$/i, '').replace(/\\/g, '/').toLowerCase();
}

function normalizeStarterFolderPath(input: string): string {
  return input
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTitleFromMarkdown(content: string): string | null {
  const frontmatterTitle = content.match(/^---\n[\s\S]*?^title:\s*(.+?)\s*$/m)?.[1]?.trim();
  if (frontmatterTitle) return frontmatterTitle.replace(/^["']|["']$/g, '');
  const heading = content.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim();
  return heading || null;
}

/**
 * Creates a new memory note with proper frontmatter and path.
 * Memory folder structure:
 *   /Memory/Agents/      - One file per agent
 *   /Memory/Team/        - Shared team memory
 *   /Memory/Projects/    - Project-level memories
 *   /Memory/User/        - User preferences
 *   /Memory/Skills/      - Skill learnings
 *   /Memory/Tools/       - Tool usage notes
 *   /Memory/Decisions/   - Decision logs
 *   /Memory/Runs/        - Run summaries
 */
export async function saveMemoryNote(
  rootHandle: FileSystemDirectoryHandle,
  source: VaultSource,
  content: string,
  memoryType: 'agent' | 'team' | 'project' | 'user' | 'skill' | 'tool' | 'decision' | 'run',
  target?: string,
  pathOverride?: string,
): Promise<VaultNote> {
  const folderByType: Record<string, string> = {
    agent: 'Agents',
    team: 'Team',
    project: 'Projects',
    user: 'User',
    skill: 'Skills',
    tool: 'Tools',
    decision: 'Decisions',
    run: 'Runs',
  };

  const folder = folderByType[memoryType] ?? 'User';
  const timestamp = new Date().toISOString().split('T')[0];

  let fileName: string;
  if (target) {
    fileName = `${sanitizeFileName(target)} Memory ${timestamp}.md`;
  } else {
    fileName = `${memoryType.charAt(0).toUpperCase() + memoryType.slice(1)} Memory ${timestamp}.md`;
  }

  const path = pathOverride
    ? normalizeVaultPath(pathOverride)
    : normalizeVaultPath(`Memory/${folder}/${fileName}`);

  // Use createNote to create the file with proper directory structure
  return createNote(rootHandle, source, path, content);
}

function sanitizeFileName(input: string): string {
  return (
    input
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'Memory'
  );
}

/**
 * Appends content to an existing memory note.
 */
export async function appendToMemoryNote(
  rootHandle: FileSystemDirectoryHandle,
  note: VaultNote,
  content: string,
): Promise<VaultNote> {
  const timestamp = new Date().toISOString().split('T')[0];
  const newContent = note.content + `\n\n---\n\n**Saved:** ${timestamp}\n\n${content}`;
  return writeNote(note, newContent);
}
