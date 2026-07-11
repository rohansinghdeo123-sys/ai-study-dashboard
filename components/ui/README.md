# AgentifyAI UI Primitives

Use `components/ui/primitives.tsx` for new shared controls. The primitives are backed by the semantic `--ds-*` token contract in `app/styles/design-system.css`.

Core rules:

- Prefer `Button`, `IconButton`, `FormField`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch`, `Tabs`, `Dialog`, `Alert`, `Card`, `Badge`, `Table`, `Skeleton`, and state components before adding page-specific UI.
- Use `--ds-radius-md` for controls and `--ds-radius-lg` for cards. Pills are reserved for badges and progress/status chips.
- Use `--ds-accent-teal` for primary learning actions and `--ds-accent-gold` for highlights, never as a dominant page wash.
- Every icon-only action must have an accessible label.
- Dialogs and destructive actions should use `ConfirmDialog`; backend authority still belongs on the server.
