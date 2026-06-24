export function Supergraphic() {
  return (
    <div className="supergraphic" aria-hidden="true">
      <svg
        width="100%"
        height="3"
        viewBox="0 0 100 3"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="supergraphic-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0" />
            <stop offset="20%" stopColor="var(--primary)" stopOpacity="0.6" />
            <stop offset="50%" stopColor="var(--accent)" stopOpacity="0.8" />
            <stop offset="80%" stopColor="var(--primary)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="100%" height="3" fill="url(#supergraphic-grad)" />
      </svg>
    </div>
  );
}
