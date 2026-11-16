"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Download, MoreHorizontal, Pencil, RotateCcw, Send, Trash2 } from "lucide-react";
import type { ClientRow } from "@/lib/data/types";
import { t } from "@/lib/i18n/sr";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ClientForm } from "../client-form";
import { deleteClientAction, resendInviteAction, setClientStatusAction } from "../actions";

export function ClientActions({ client, canInvite }: { client: ClientRow; canInvite: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.ok) { toast(success); after?.(); router.refresh(); }
      else toast(res.error ?? t.errors.generic, "error");
    });

  return (
    <>
      <Button variant="secondary" onClick={() => setEditOpen(true)}><Pencil className="size-4" />{t.common.edit}</Button>
      <Dropdown>
        <DropdownTrigger asChild>
          <Button variant="secondary" size="icon" aria-label={t.common.actions}><MoreHorizontal className="size-4" /></Button>
        </DropdownTrigger>
        <DropdownContent>
          {canInvite && client.status !== "archived" && (
            <DropdownItem onSelect={() => run(() => resendInviteAction(client.id), t.clients.account.inviteSent)}><Send className="size-4" />{t.clients.account.resendInvite}</DropdownItem>
          )}
          <DropdownItem asChild><a href={`/trener/klijenti/${client.id}/izvoz`} download><Download className="size-4" />{t.clients.export}</a></DropdownItem>
          <DropdownSeparator />
          {client.status === "archived" ? (
            <DropdownItem onSelect={() => run(() => setClientStatusAction(client.id, "active"), t.clients.restored)}><RotateCcw className="size-4" />{t.common.restore}</DropdownItem>
          ) : (
            <DropdownItem onSelect={() => setArchiveOpen(true)}><Archive className="size-4" />{t.common.archive}</DropdownItem>
          )}
          {canInvite && <DropdownItem danger onSelect={() => setDeleteOpen(true)}><Trash2 className="size-4" />{t.clients.deleteTitle}</DropdownItem>}
        </DropdownContent>
      </Dropdown>

      <Modal open={editOpen} onOpenChange={setEditOpen} title={t.clients.editTitle} size="lg">
        <ClientForm client={client} onDone={() => setEditOpen(false)} />
      </Modal>

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={t.common.archive}
        description={t.clients.archiveConfirm}
        confirmLabel={t.common.archive}
        loading={pending}
        onConfirm={() => run(() => setClientStatusAction(client.id, "archived"), t.clients.archived, () => setArchiveOpen(false))}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(o) => { setDeleteOpen(o); if (!o) setConfirmName(""); }}
        title={t.clients.deleteTitle}
        description={t.clients.deleteConfirm}
        confirmLabel={t.common.delete}
        loading={pending}
        onConfirm={() => {
          if (confirmName.trim().toLowerCase() !== client.full_name.trim().toLowerCase()) { toast(t.clients.deleteTypeName, "error"); return; }
          start(async () => {
            const res = await deleteClientAction(client.id, confirmName);
            if (res.ok) { toast(t.clients.deleted); router.replace("/trener/klijenti"); router.refresh(); }
            else toast(res.error, "error");
          });
        }}
      >
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted">{t.clients.deleteTypeName} <strong className="text-ink">{client.full_name}</strong></span>
          <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" />
        </label>
      </ConfirmDialog>
    </>
  );
}
