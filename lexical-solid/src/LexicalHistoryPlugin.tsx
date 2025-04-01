import { JSX } from "solid-js";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import { useHistory } from "./shared/useHistory";
import type { HistoryState, HistoryStateEntry } from "@lexical/history";

function HistoryPlugin(props: {
  delay?: number;
  externalHistoryState?: HistoryState;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  useHistory(
    editor,
    () => props.externalHistoryState,
    () => props.delay
  );
  return null;
}

export { createEmptyHistoryState } from "@lexical/history";
export { HistoryPlugin };
export type { HistoryStateEntry, HistoryState };
