import { LexicalEditor } from "lexical";
import { $canShowPlaceholderCurry } from "@lexical/text";
import { mergeRegister } from "@lexical/utils";
import { Accessor, createSignal, onCleanup, onMount } from "solid-js";

function canShowPlaceholderFromCurrentEditorState(
  editor: LexicalEditor
): boolean {
  const currentCanShowPlaceholder = editor
    .getEditorState()
    .read($canShowPlaceholderCurry(editor.isComposing()));

  return currentCanShowPlaceholder;
}

export function useCanShowPlaceholder(
  editor: LexicalEditor
): Accessor<boolean> {
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
    onCleanup(
      mergeRegister(
        editor.registerUpdateListener(() => {
          resetCanShowPlaceholder();
        }),
        editor.registerEditableListener(() => {
          resetCanShowPlaceholder();
        })
      )
    );
  });

  return canShowPlaceholder;
}
