import type { EditorState, LexicalEditor } from "lexical";
import { createEffect, mergeProps, onCleanup } from "solid-js";
import { useLexicalComposerContext } from "./LexicalComposerContext";

function OnChangePlugin(props: {
  onChange?: (editorState: EditorState, editor: LexicalEditor) => void;
  ignoreInitialChange?: boolean;
  ignoreSelectionChange?: boolean;
}) {
  props = mergeProps(
    { ignoreInitialChange: true, ignoreSelectionChange: false },
    props
  );
  const [editor] = useLexicalComposerContext();
  createEffect(() => {
    if (props.onChange) {
      onCleanup(
        editor.registerUpdateListener(
          ({ editorState, dirtyElements, dirtyLeaves, prevEditorState }) => {
            if (
              props.ignoreSelectionChange &&
              dirtyElements.size === 0 &&
              dirtyLeaves.size === 0
            ) {
              return;
            }

            if (props.ignoreInitialChange && prevEditorState.isEmpty()) {
              return;
            }

            props.onChange!(editorState, editor);
          }
        )
      );
    }
  });
  return null;
}

export default OnChangePlugin;
