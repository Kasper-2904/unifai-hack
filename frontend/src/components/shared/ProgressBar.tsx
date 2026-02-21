// ProgressBar — a thin horizontal bar showing percentage completion.
// Pass a value from 0 to 1 (e.g. 0.6 = 60% filled).

interface ProgressBarProps {
  value: number; // 0 to 1
}

export function ProgressBar({ value }: ProgressBarProps) {
  const percent = Math.round(Math.min(Math.max(value, 0), 1) * 100);

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full bg-sky-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 w-8 text-right">{percent}%</span>
    </div>
  );
}
