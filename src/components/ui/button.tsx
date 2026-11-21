import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

export const buttonVariants = cva(
  "ripple-host inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-transparent font-bold transition-[background-color,color,border-color,box-shadow,transform] duration-300 ease-[cubic-bezier(.2,.7,.2,1)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 select-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-300 hover:[&_.lucide-arrow-right]:translate-x-1",
  {
    variants: {
      variant: {
        primary: "border-ink bg-ink text-white hover:border-accent hover:bg-accent hover:shadow-[var(--shadow-glow)]",
        accent: "border-accent bg-accent text-white hover:border-ink hover:bg-ink hover:shadow-[0_14px_30px_-14px_rgba(14,12,16,0.7)]",
        mint: "border-mint bg-mint text-ink hover:border-ink hover:bg-ink hover:text-white hover:shadow-[0_14px_30px_-14px_var(--color-mint)]",
        secondary: "border-line bg-surface text-ink hover:border-accent hover:text-accent",
        ghost: "text-ink-2 hover:bg-hover hover:text-ink",
        subtle: "bg-subtle text-ink hover:bg-line",
        danger: "border-danger bg-danger text-white hover:brightness-110 hover:shadow-[0_14px_30px_-14px_var(--color-danger)]",
        "danger-ghost": "text-danger hover:bg-danger-soft",
        link: "text-accent underline-offset-4 hover:underline rounded-none px-0 h-auto",
      },
      size: {
        sm: "h-10 px-4 text-[13px]",
        md: "h-12 px-6 text-sm",
        lg: "h-12 px-6 text-[15px]",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8 [&_svg]:size-[15px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
        {asChild ? children : (
          <>
            {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";
