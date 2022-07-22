import { createSignal, onMount } from "solid-js";
import { LexicalEditor } from "lexical";
import { $canShowPlaceholderCurry } from "@lexical/text";
import { mergeRegister } from "@lexical/utils";

function canShowPlaceholderFromCurrentEditorState(
  editor: LexicalEditor,
): boolean {
  const currentCanShowPlaceholder = editor
    .getEditorState()
    .read($canShowPlaceholderCurry(editor.isComposing(), editor.isReadOnly()));

  return currentCanShowPlaceholder;
}

export function useCanShowPlaceholder(editor: LexicalEditor) {
  const [canShowPlaceholder, setCanShowPlaceholder] = createSignal(
   canShowPlaceholderFromCurrentEditorState(editor)
  );
  onMount(() => {
    function resetCanShowPlaceholder() {
      const currentCanShowPlaceholder =
        canShowPlaceholderFromCurrentEditorState(editor);
      setCanShowPlaceholder(currentCanShowPlaceholder);
    }
    resetCanShowPlaceholder();
    return mergeRegister(
      editor.registerUpdateListener(() => {
        resetCanShowPlaceholder();
      }),
      editor.registerReadOnlyListener(() => {
        resetCanShowPlaceholder();
      }),
    );
  });
  return canShowPlaceholder;
}

