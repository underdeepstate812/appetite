export function LoadingView({ label }: { label: string }) {
  return <p className="state-message">{label}</p>;
}

export function EmptyView({ label }: { label: string }) {
  return <p className="state-message">{label}</p>;
}

export function ErrorView({ label }: { label: string }) {
  return <p className="state-message" style={{ color: "var(--color-danger)" }}>{label}</p>;
}
