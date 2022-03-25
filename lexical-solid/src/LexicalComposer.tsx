import { createEffect, JSX, useContext } from "solid-js";
import { createEditor } from "lexical";
import type { EditorThemeClasses, LexicalEditor, LexicalNode } from "lexical";
import type { Class } from "utility-types";
import {
  LexicalComposerContext,
  createLexicalComposerContext,
} from "./LexicalComposerContext";

type Props = {
  initialConfig: {
    editor?: LexicalEditor | null;
    readOnly?: boolean;
    namespace?: string;
    nodes?: Array<Class<LexicalNode>>;
    theme?: EditorThemeClasses;
    onError: (error: Error, editor: LexicalEditor) => void;
  };
  children: JSX.Element;
};

function LexicalComposer(props: Props) {
  const parentContext = useContext(LexicalComposerContext);
  let composerTheme;
  let parentEditor;
  const {
    theme,
    namespace,
    editor: initialEditor,
    nodes,
    onError,
  } = props.initialConfig;

  if (theme != null) {
    composerTheme = theme;
  } else if (parentContext != null) {
    parentEditor = parentContext[0];
    const parentTheme = parentContext[1].getTheme();

    if (parentTheme != null) {
      composerTheme = parentTheme;
    }
  }

  const context = createLexicalComposerContext(parentContext, composerTheme);
  let editor = initialEditor;

  if (!editor) {
    const newEditor: LexicalEditor = createEditor({
      context,
      namespace,
      nodes,
      onError: (error) => onError(error, newEditor),
      parentEditor,
      readOnly: true,
      theme: composerTheme,
    });
    editor = newEditor;
  }

  createEffect(() => {
    const isReadOnly = props.initialConfig.readOnly;
    editor!.setReadOnly(isReadOnly || false);
  });
  return (
    <LexicalComposerContext.Provider value={[editor, context]}>
      {props.children}
    </LexicalComposerContext.Provider>
  );
}

export default LexicalComposer;
