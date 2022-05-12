import { createSignal, onMount } from "solid-js";
import { LexicalEditor } from "lexical";
import text, { $canShowPlaceholderCurry } from "@lexical/text";


function useLexicalCanShowPlaceholder(editor: LexicalEditor) {
  const [canShowPlaceholder, setCanShowPlaceholder] = createSignal(
    editor.getEditorState().read($canShowPlaceholderCurry(editor.isComposing()))
  );
  onMount(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      const isComposing = editor.isComposing();
      const currentCanShowPlaceholder = editorState.read(
        text.$canShowPlaceholderCurry(isComposing)
      );
      setCanShowPlaceholder(currentCanShowPlaceholder);
    });
  });
  return canShowPlaceholder;
}

export default useLexicalCanShowPlaceholder;
