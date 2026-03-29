import { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonVariant = "primary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({
  children,
  className = "",
  variant = "primary",
  type = "button",
  ...props
}: PropsWithChildren<ButtonProps>) {
  const classes = ["button", variant === "ghost" ? "button--ghost" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
}

