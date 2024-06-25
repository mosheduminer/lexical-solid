import type { LexicalEditor } from "lexical";

import { COMMAND_PRIORITY_CRITICAL, LexicalCommand } from "lexical";
import { Accessor, createSignal, onCleanup, onMount } from "solid-js";

export type LexicalCommandLog = ReadonlyArray<
  { index: number } & LexicalCommand<unknown> & { payload: unknown }
>;

export function registerLexicalCommandLogger(
  editor: LexicalEditor,
  setLoggedCommands: (
    v: (oldValue: LexicalCommandLog) => LexicalCommandLog
  ) => void
): () => void {
  const unregisterCommandListeners = new Set<() => void>();
  let i = 0;
  for (const [command] of editor._commands) {
    unregisterCommandListeners.add(
      editor.registerCommand(
        command,
        (payload) => {
          setLoggedCommands((state) => {
            i += 1;
            const newState = [...state];
            newState.push({
              index: i,
              payload,
              type: command.type ? command.type : "UNKNOWN",
            });

            if (newState.length > 10) {
              newState.shift();
            }

            return newState;
          });

          return false;
        },
        COMMAND_PRIORITY_CRITICAL
      )
    );
  }

  return () => unregisterCommandListeners.forEach((unregister) => unregister());
}

export function useLexicalCommandsLog(
  editor: LexicalEditor
): Accessor<LexicalCommandLog> {
  const [loggedCommands, setLoggedCommands] = createSignal<LexicalCommandLog>(
    []
  );

  onMount(() =>
    onCleanup(registerLexicalCommandLogger(editor, setLoggedCommands))
  );

  return loggedCommands;
}
