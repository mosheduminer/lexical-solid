import { Setter } from "solid-js";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import { LexicalEditor } from "lexical";

/**
 *
 * Use this plugin to access the editor instance outside of the
 * LexicalComposer. This can help with things like buttons or other
 * UI components that need to update or read EditorState but need to
 * be positioned outside the LexicalComposer in the React tree.
 */
export function EditorRefPlugin(props: {
  editorRef: Setter<LexicalEditor>;
}): null {
  const [editor] = useLexicalComposerContext();
  props.editorRef(editor);
  return null;
}
