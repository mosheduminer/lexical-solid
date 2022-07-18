import type { LexicalEditor } from "lexical";

import { $isRootTextContentEmptyCurry } from "@lexical/text";
import { Accessor, createEffect, createSignal, onCleanup } from "solid-js";
import { MaybeAccessor, resolve } from "./utils";

export function useLexicalIsTextContentEmpty(
  editor: LexicalEditor,
  trim?: MaybeAccessor<boolean>
): Accessor<boolean> {
  const [isEmpty, setIsEmpty] = createSignal(
    editor
      .getEditorState()
      .read($isRootTextContentEmptyCurry(editor.isComposing(), resolve(trim)))
  );

  createEffect(() => {
    const cleanup = editor.registerUpdateListener(({ editorState }) => {
      const isComposing = editor.isComposing();
      const currentIsEmpty = editorState.read(
        $isRootTextContentEmptyCurry(isComposing, resolve(trim))
      );
      setIsEmpty(currentIsEmpty);
    });
    onCleanup(cleanup);
  });
  return isEmpty;
}
