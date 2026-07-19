"use client";

import { useState } from "react";
import {
  Button,
  ConfirmDialog,
  Dialog,
  FormField,
  Input,
} from "@/components/ui/primitives";

export function StudyConfirmDialog({
  open,
  title,
  detail,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  detail: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      title={title}
      detail={detail}
      confirmLabel={confirmLabel}
      cancelLabel="Keep working"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

export function RenameConversationDialog({
  open,
  initialTitle,
  onCancel,
  onRename,
}: {
  open: boolean;
  initialTitle: string;
  onCancel: () => void;
  onRename: (title: string) => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const trimmedTitle = title.trim();

  return (
    <Dialog
      open={open}
      title="Rename chat"
      onClose={onCancel}
      footer={(
        <>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onRename(trimmedTitle)}
            disabled={!trimmedTitle}
          >
            Save name
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <p>
          Give this conversation a short name so it is easier to find in your Study Lab history.
        </p>
        <FormField label="Chat name">
          <Input
            value={title}
            maxLength={72}
            autoFocus
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && trimmedTitle) {
                event.preventDefault();
                onRename(trimmedTitle);
              }
            }}
          />
        </FormField>
      </div>
    </Dialog>
  );
}
