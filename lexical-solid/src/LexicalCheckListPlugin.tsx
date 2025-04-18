import { registerCheckList } from "@lexical/list";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import { createEffect, onCleanup } from "solid-js";

export function CheckListPlugin(): null {
  const [editor] = useLexicalComposerContext();

  createEffect(() => {
    onCleanup(registerCheckList(editor));
  });

  return null;
}
