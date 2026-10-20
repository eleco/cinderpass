export const REPO_URL = 'https://github.com/eleco/cinderpass';

const sha = process.env.NEXT_PUBLIC_COMMIT_SHA;

// Builds without git metadata report 'unknown'; linking to /commit/unknown would 404.
export const COMMIT_SHA = sha && /^[0-9a-f]{7,40}$/i.test(sha) ? sha : null;
export const COMMIT_URL = COMMIT_SHA ? `${REPO_URL}/commit/${COMMIT_SHA}` : null;
