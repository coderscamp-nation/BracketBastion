// Small line icons shared by the HUD and the menus.

export function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect x="2" y="1" width="3.5" height="12" fill="currentColor" />
      <rect x="8.5" y="1" width="3.5" height="12" fill="currentColor" />
    </svg>
  );
}

export function MusicIcon({ off = false }: { off?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M6 12V3.5l7-1.5v8.5" />
      <circle cx="4.2" cy="12" r="1.9" fill="currentColor" />
      <circle cx="11.2" cy="10.5" r="1.9" fill="currentColor" />
      {off && <path d="M2 2l12 12" strokeWidth="1.8" />}
    </svg>
  );
}

export function SoundIcon({ off = false }: { off?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M2 6h2.5L8 3v10L4.5 10H2z" fill="currentColor" />
      {off ? <path d="M10.5 6l4 4m0-4l-4 4" /> : <path d="M10.5 5.5a3.5 3.5 0 010 5M12.3 3.7a6 6 0 010 8.6" />}
    </svg>
  );
}

export function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="8" cy="8" r="6.6" />
      <path d="M8 7.3v4.1" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="8" cy="4.7" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg width="15" height="16" viewBox="0 0 15 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="2" y="7" width="11" height="7.5" fill="currentColor" stroke="none" />
      <path d="M4.5 7V5a3 3 0 016 0v2" />
    </svg>
  );
}
