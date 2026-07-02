import * as React from "react";

import { cn } from "@/lib/utils";

function Progress({
  className,
  value = 0,
  ...props
}: React.ComponentProps<"div"> & {
  value?: number;
}) {
  const safeValue = Math.min(Math.max(value, 0), 100);

  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-white/10",
        className,
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
      {...props}
    >
      <div
        className="h-full rounded-full bg-emerald-300 transition-all"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

export { Progress };
