import { COMMIT_SHA, COMMIT_URL, REPO_URL } from '@/lib/source';

// Every page links to the source and, when known, the exact deployed commit,
// so visitors can verify the JavaScript they are running.
export function SiteFooter({ showHome = true }: { showHome?: boolean }) {
  return (
    <footer className="footer">
      {showHome ? <a href="/" className="version-badge">Home</a> : null}
      <a href="/architecture" className="version-badge">Architecture</a>
      <a href="/faq" className="version-badge">FAQ</a>
      <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="version-badge">
        Open source on GitHub ↗
      </a>
      {COMMIT_URL ? (
        <a href={COMMIT_URL} target="_blank" rel="noopener noreferrer" className="version-badge" title={COMMIT_SHA!}>
          build {COMMIT_SHA!.slice(0, 7)} ↗
        </a>
      ) : null}
    </footer>
  );
}
