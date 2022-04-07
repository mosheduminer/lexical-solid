import { LexicalEditor } from "lexical";
import history from "@lexical/history";
import { Accessor, createEffect, JSX } from "solid-js";
import { useLexicalComposerContext } from "./LexicalComposerContext";

type HistoryStateEntry = history.HistoryStateEntry;
type HistoryState = history.HistoryState;

const createEmptyHistoryState = history.createEmptyHistoryState;

function useHistory(
  editor: LexicalEditor,
  externalHistoryState: Accessor<HistoryState | undefined>,
  delay: number = 1000
) {
  const historyState = () =>
    externalHistoryState() || createEmptyHistoryState();
  createEffect(() => {
    return history.registerHistory(editor, historyState(), delay);
  });
}

function HistoryPlugin(props: {
  externalHistoryState?: HistoryState;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  useHistory(editor, () => props.externalHistoryState);
  return null;
}

export { HistoryPlugin, createEmptyHistoryState };
export type { HistoryStateEntry, HistoryState };
