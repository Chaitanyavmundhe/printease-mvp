# Agent Work Rules

1. **Always read the context maps first.** Look up the domain, flow, module, and contract before touching any file.
2. **Never refactor large files.** If you see a 500-line controller, do not rewrite it. Extract the specific logic you need into a tiny component.
3. **Only edit 1 to 3 files per task.** A task that requires modifying 10 files is too large and must be broken down further.
4. **Follow the State Machines.** Do not invent new states for orders or print jobs. Use what is defined in `06-state-machines.md`.
5. **Treat desktop as untrusted.** All payloads from the Electron renderer must be strictly validated before passing them to OS execution.
