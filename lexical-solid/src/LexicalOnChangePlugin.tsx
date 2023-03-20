import type { EditorState, LexicalEditor } from "lexical";
import { createEffect, mergeProps, onCleanup } from "solid-js";
import { useLexicalComposerContext } from "./LexicalComposerContext";

export function OnChangePlugin(props: {
  ignoreHistoryMergeTagChange?: boolean;
  onChange?: (
    editorState: EditorState,
    tags: Set<string>,
    editor: LexicalEditor
  ) => void;
  ignoreSelectionChange?: boolean;
}) {
  props = mergeProps(
    {
      ignoreSelectionChange: false,
      ignoreHistoryMergeTagChange: true,
    },
    props
  );
  const [editor] = useLexicalComposerContext();
  createEffect(() => {
    if (props.onChange) {
      onCleanup(
        editor.registerUpdateListener(
          ({
            editorState,
            dirtyElements,
            dirtyLeaves,
            prevEditorState,
            tags,
          }) => {
            if (
              (props.ignoreSelectionChange &&
                dirtyElements.size === 0 &&
                dirtyLeaves.size === 0) ||
              (props.ignoreHistoryMergeTagChange &&
                tags.has("history-merge")) ||
              prevEditorState.isEmpty()
            ) {
              return;
            }

            props.onChange!(editorState, tags, editor);
          }
        )
      );
    }
  });
  return null;
}
