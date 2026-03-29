import { HTMLAttributes, PropsWithChildren } from "react";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export function Panel({
  children,
  className = "",
  padded = true,
  ...props
}: PropsWithChildren<PanelProps>) {
  const classes = ["panel", padded ? "panel--padded" : "", className].filter(Boolean).join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

