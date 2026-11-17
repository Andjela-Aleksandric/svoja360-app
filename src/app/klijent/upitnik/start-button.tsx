"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { startCheckinAction, startInitialAction } from "@/app/actions/questionnaire";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function StartButton({ kind, label, href, ...props }: { kind: "initial" | "checkin"; label: string; href: string } & Omit<ButtonProps, "onClick">) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <Button {...props} loading={pending} onClick={() => start(async () => {
      const res = kind === "initial" ? await startInitialAction() : await startCheckinAction();
      if (!res.ok) { toast(res.error, "error"); return; }
      router.push(href);
      router.refresh();
    })}>{label}</Button>
  );
}
