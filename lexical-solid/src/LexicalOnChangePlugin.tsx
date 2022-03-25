import type { EditorState, LexicalEditor } from "lexical";
import { createEffect, mergeProps } from "solid-js";
import { useLexicalComposerContext } from "./LexicalComposerContext";

export default function OnChangePlugin(props: {
  onChange?: (editorState: EditorState, editor: LexicalEditor) => void;
  ignoreInitialChange?: boolean;
  ignoreSelectionChange?: boolean;
}): null {
  const [editor] = useLexicalComposerContext();
  props = mergeProps(
    { ignoreInitialChange: true, ignoreSelectionChange: true },
    props
  );
  createEffect(() => {
    if (props.onChange) {
      return editor.addListener(
        "update",
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
      );
    }
  });
  return null;
}
