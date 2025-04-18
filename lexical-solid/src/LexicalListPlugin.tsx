import { ListItemNode, registerListStrictIndentTransform } from "@lexical/list";
import { ListNode } from "@lexical/list";
import { createEffect, mergeProps, onCleanup } from "solid-js";
import { useLexicalComposerContext } from "./LexicalComposerContext";

import { useList } from "./shared/useList";

export interface ListPluginProps {
  /**
   * When `true`, enforces strict indentation rules for list items, ensuring consistent structure.
   * When `false` (default), indentation is more flexible.
   */
  hasStrictIndent?: boolean;
}

export function ListPlugin(props: ListPluginProps): null {
  props = mergeProps({ hasStrictIndent: false }, props);
  const [editor] = useLexicalComposerContext();

  createEffect(() => {
    if (!editor.hasNodes([ListNode, ListItemNode])) {
      throw new Error(
        "ListPlugin: ListNode and/or ListItemNode not registered on editor"
      );
    }
  });

  createEffect(() => {
    if (!props.hasStrictIndent) {
      return;
    }
    onCleanup(registerListStrictIndentTransform(editor));
  });

  useList(editor);

  return null;
}
