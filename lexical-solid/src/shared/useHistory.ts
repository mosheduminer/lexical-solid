import { LexicalEditor } from "lexical";
import {
  registerHistory,
  HistoryState,
  createEmptyHistoryState,
} from "@lexical/history";
import { Accessor, createEffect } from "solid-js";

function useHistory(
  editor: LexicalEditor,
  externalHistoryState: Accessor<HistoryState | undefined>,
  delay: number = 1000
) {
  const historyState = () =>
    externalHistoryState() || createEmptyHistoryState();
  createEffect(() => {
    return registerHistory(editor, historyState(), delay);
  });
}

export { useHistory };
