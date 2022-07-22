import { JSX, onMount } from "solid-js";
import { createEditor, EditorState, Klass } from "lexical";
import type { EditorThemeClasses, LexicalEditor, LexicalNode } from "lexical";
import {
  LexicalComposerContext,
  createLexicalComposerContext,
} from "lexical-solid/LexicalComposerContext";


export type InitialEditorStateType =
  | null
  | string
  | EditorState
  | ((editor: LexicalEditor) => void);

type Props = {
  children: JSX.Element | string | (JSX.Element | string)[];
  initialConfig: Readonly<{
    namespace: string;
    nodes?: ReadonlyArray<Klass<LexicalNode>>;
    onError: (error: Error, editor: LexicalEditor) => void;
    readOnly?: boolean;
    theme?: EditorThemeClasses;
    editorState?: InitialEditorStateType;
  }>;
};

export function LexicalComposer(props: Props) {
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
