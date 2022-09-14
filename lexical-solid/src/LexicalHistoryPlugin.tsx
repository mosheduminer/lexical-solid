import { JSX } from "solid-js";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import { useHistory } from "./shared/useHistory";
import type { HistoryState, HistoryStateEntry } from "@lexical/history";

function HistoryPlugin(props: {
  externalHistoryState?: HistoryState;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  useHistory(editor, () => props.externalHistoryState);
  return null;
}

export { createEmptyHistoryState } from "@lexical/history";
export { HistoryPlugin };
export type { HistoryStateEntry, HistoryState };
