import type { EditorState, LexicalEditor } from "lexical";
import { createEffect, mergeProps, onCleanup } from "solid-js";
import { useLexicalComposerContext } from "./LexicalComposerContext";

export function OnChangePlugin(props: {
  ignoreHistoryMergeTagChange?: boolean;
  onChange?: (editorState: EditorState, editor: LexicalEditor) => void;
  ignoreInitialChange?: boolean;
  // TODO 0.4 remove
  ignoreSelectionChange?: boolean;
}) {
  props = mergeProps(
    {
      ignoreInitialChange: true,
      ignoreSelectionChange: false,
      // TODO 0.5 flip to true
      ignoreHistoryMergeTagChange: false,
    },
    props
  );
  const [editor] = useLexicalComposerContext();
  createEffect(() => {
    if (props.onChange) {
      onCleanup(
        editor.registerUpdateListener(
          ({ editorState, dirtyElements, dirtyLeaves, prevEditorState, tags }) => {
            if (
              (props.ignoreSelectionChange &&
                dirtyElements.size === 0 &&
                dirtyLeaves.size === 0) ||
              (props.ignoreHistoryMergeTagChange && tags.has('history-merge'))
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
