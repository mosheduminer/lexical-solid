import { createEffect, onCleanup } from "solid-js";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import { selectionAlwaysOnDisplay } from "@lexical/utils";

export function SelectionAlwaysOnDisplay(): null {
  const [editor] = useLexicalComposerContext();
  createEffect(() => {
    onCleanup(selectionAlwaysOnDisplay(editor));
  });

  return null;
}
