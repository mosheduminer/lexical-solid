import { JSX } from "solid-js";
import { useLexicalComposerContext } from "lexical-solid/LexicalComposerContext";
import { useHistory } from "lexical-solid/shared/useHistory";
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
