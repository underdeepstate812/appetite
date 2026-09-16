interface StatCardProps {
  label: string;
  value: string;
  tone?: "primary" | "success" | "warning" | "muted";
}

const TONE_COLOR: Record<NonNullable<StatCardProps["tone"]>, string> = {
  primary: "var(--color-primary)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  muted: "var(--color-text)",
};

export function StatCard({ label, value, tone = "muted" }: StatCardProps) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 800, color: TONE_COLOR[tone], marginTop: 6 }}>{value}</p>
    </div>
  );
}
