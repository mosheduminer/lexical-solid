import { ListItemNode } from "@lexical/list";
import { ListNode } from "@lexical/list";
import { createEffect } from "solid-js";
import { useLexicalComposerContext } from "./LexicalComposerContext";

import { useList } from "./shared/useList";

export function ListPlugin(): null {
  const [editor] = useLexicalComposerContext();

  createEffect(() => {
    if (!editor.hasNodes([ListNode, ListItemNode])) {
      throw new Error(
        'ListPlugin: ListNode and/or ListItemNode not registered on editor',
      );
    }
  });


  useList(editor);

  return null;
}
