/**
 * Local author identity used for tasks and agent runs.
 *
 * The app does not yet have a full authentication system; for thread
 * ownership and "edit your own comments" rules we keep a stable,
 * generated local author identity stored in localStorage.
 */

export interface LocalAuthor {
  id: string;
  name: string;
  createdAt: string;
}

const LOCAL_AUTHOR_KEY = 'agentVault.localAuthor.v1';

function makeAuthor(): LocalAuthor {
  return {
    id: `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: 'You',
    createdAt: new Date().toISOString(),
  };
}

let cached: LocalAuthor | null = null;

export function getLocalAuthor(): LocalAuthor {
  if (cached) return cached;
  if (typeof localStorage === 'undefined') {
    cached = makeAuthor();
    return cached;
  }
  try {
    const raw = localStorage.getItem(LOCAL_AUTHOR_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.id === 'string' && typeof parsed.name === 'string') {
        cached = parsed as LocalAuthor;
        return cached;
      }
    }
  } catch {
    // ignore parse failures and create a new author
  }
  const author = makeAuthor();
  cached = author;
  try {
    localStorage.setItem(LOCAL_AUTHOR_KEY, JSON.stringify(author));
  } catch {
    // ignore
  }
  return author;
}