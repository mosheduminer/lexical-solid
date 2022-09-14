import { LexicalEditor } from "lexical";
import {
  registerHistory,
  HistoryState,
  createEmptyHistoryState,
} from "@lexical/history";
import { Accessor, createEffect, onCleanup } from "solid-js";

function useHistory(
  editor: LexicalEditor,
  externalHistoryState: Accessor<HistoryState | undefined>,
  delay: number = 1000
) {
  const historyState = () =>
    externalHistoryState() || createEmptyHistoryState();
  createEffect(() => {
    onCleanup(registerHistory(editor, historyState(), delay));
  });
}

export { useHistory };
