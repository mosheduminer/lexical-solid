import type { LexicalEditor, NodeKey } from "lexical";

import { useLexicalComposerContext } from "./LexicalComposerContext";
import {
  $createNodeSelection,
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  $setSelection,
} from "lexical";
import { createSignal, onCleanup, onMount } from "solid-js";

function isNodeSelected(editor: LexicalEditor, key: NodeKey): boolean {
  return editor.getEditorState().read(() => {
    const node = $getNodeByKey(key);
    if (node === null) {
      return false;
    }
    return node.isSelected();
  });
}

export function useLexicalNodeSelection(
  key: NodeKey
): [() => boolean, (arg: boolean) => void, () => void] {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setIsSelected] = createSignal(isNodeSelected(editor, key));

  onMount(() => {
    let isMounted = true;
    const unregister = editor.registerUpdateListener(() => {
      if (isMounted) {
        setIsSelected(isNodeSelected(editor, key));
      }
    });

    onCleanup(() => {
      isMounted = false;
      unregister();
    });
  });

  const setSelected = (selected: boolean) => {
    editor.update(() => {
      let selection = $getSelection();
      if (!$isNodeSelection(selection)) {
        selection = $createNodeSelection();
        $setSelection(selection);
      }
      if (selected) {
        selection.add(key);
      } else {
        selection.delete(key);
      }
    });
  };

  const clearSelected = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isNodeSelection(selection)) {
        selection.clear();
      }
    });
  };

  return [isSelected, setSelected, clearSelected];
}
