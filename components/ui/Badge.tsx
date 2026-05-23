type Color = "gray" | "gold" | "green" | "amber" | "red" | "blue";

interface BadgeProps {
  color?: Color;
  children: React.ReactNode;
  className?: string;
}

const colorClasses: Record<Color, string> = {
  gray:  "bg-surface-high text-ink-dim",
  gold:  "bg-gold-dim text-gold",
  green: "bg-success-dim text-success",
  amber: "bg-warning-dim text-warning",
  red:   "bg-danger-dim text-danger",
  blue:  "bg-surface-high text-ink-dim",
};

export function Badge({ color = "gray", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClasses[color]} ${className}`}
    >
      {children}
    </span>
  );
}
