import { JSX, onMount } from "solid-js";
import { createEditor } from "lexical";
import type { EditorThemeClasses, LexicalEditor, LexicalNode } from "lexical";
import type { Class } from "utility-types";
import {
  LexicalComposerContext,
  createLexicalComposerContext,
} from "./LexicalComposerContext";

type Props = {
  initialConfig: {
    readOnly?: boolean;
    namespace?: string;
    nodes?: Array<Class<LexicalNode>>;
    theme?: EditorThemeClasses;
    onError: (error: Error, editor: LexicalEditor) => void;
  };
  children: JSX.Element;
};

function LexicalComposer(props: Props) {
  const { theme, namespace, nodes, onError } = props.initialConfig;
  const context = createLexicalComposerContext(null, theme);
  const editor: LexicalEditor = createEditor({
    namespace,
    nodes,
    onError: error => onError(error, editor),
    readOnly: true,
    theme
  });

  onMount(() => {
    const isReadOnly = props.initialConfig.readOnly;
    editor.setReadOnly(isReadOnly || false);
  });
  return (
    <LexicalComposerContext.Provider value={[editor, context]}>
      {props.children}
    </LexicalComposerContext.Provider>
  );
}

export default LexicalComposer;
