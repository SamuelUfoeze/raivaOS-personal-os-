import * as React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        {
          "border-transparent bg-primary text-primary-foreground shadow": variant === "default",
          "border-transparent bg-secondary text-secondary-foreground": variant === "secondary",
          "border-transparent bg-destructive text-destructive-foreground shadow": variant === "destructive",
          "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100": variant === "success",
          "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100": variant === "warning",
          "text-foreground": variant === "outline",
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };
