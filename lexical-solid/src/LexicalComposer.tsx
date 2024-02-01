import {
  LexicalComposerContextType,
  createLexicalComposerContext,
  LexicalComposerContext,
} from "./LexicalComposerContext";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  createEditor,
  EditorState,
  EditorThemeClasses,
  Klass,
  LexicalEditor,
  LexicalNode,
  LexicalNodeReplacement,
  HTMLConfig,
} from "lexical";
import { JSX, ParentProps, onMount } from "solid-js";

const HISTORY_MERGE_OPTIONS = { tag: "history-merge" };

export type InitialEditorStateType =
  | null
  | string
  | EditorState
  | ((editor: LexicalEditor) => void);

export type InitialConfigType = Readonly<{
  namespace: string;
  nodes?: ReadonlyArray<Klass<LexicalNode> | LexicalNodeReplacement>;
  onError: (error: Error, editor: LexicalEditor) => void;
  editable?: boolean;
  theme?: EditorThemeClasses;
  editorState?: InitialEditorStateType;
  html?: HTMLConfig,
}>;

type Props = ParentProps<{
  initialConfig: InitialConfigType;
}>;

export function LexicalComposer(props: Props): JSX.Element {
  const {
    editable,
    theme,
    namespace,
    nodes,
    onError,
    editorState: initialEditorState,
    html,
  } = props.initialConfig;

  const context: LexicalComposerContextType = createLexicalComposerContext(
    null,
    theme
  );

  const editor = createEditor({
    editable,
    html,
    namespace,
    nodes,
    onError: (error) => onError(error, editor),
    theme,
  });
  initializeEditor(editor, initialEditorState);

  onMount(() => {
    const isEditable = props.initialConfig.editable;
    editor.setEditable(isEditable !== undefined ? isEditable : true);
  });

  return (
    <LexicalComposerContext.Provider value={[editor, context]}>
      {props.children}
    </LexicalComposerContext.Provider>
  );
}

function initializeEditor(
  editor: LexicalEditor,
  initialEditorState?: InitialEditorStateType
): void {
  if (initialEditorState === null) {
    return;
  } else if (initialEditorState === undefined) {
    editor.update(() => {
      const root = $getRoot();
      if (root.isEmpty()) {
        const paragraph = $createParagraphNode();
        root.append(paragraph);
        const activeElement =
          typeof window !== "undefined" ? document.activeElement : null;
        if (
          $getSelection() !== null ||
          (activeElement !== null && activeElement === editor.getRootElement())
        ) {
          paragraph.select();
        }
      }
    }, HISTORY_MERGE_OPTIONS);
  } else if (initialEditorState !== null) {
    switch (typeof initialEditorState) {
      case "string": {
        const parsedEditorState = editor.parseEditorState(initialEditorState);
        editor.setEditorState(parsedEditorState, HISTORY_MERGE_OPTIONS);
        break;
      }
      case "object": {
        editor.setEditorState(initialEditorState, HISTORY_MERGE_OPTIONS);
        break;
      }
      case "function": {
        editor.update(() => {
          const root = $getRoot();
          if (root.isEmpty()) {
            initialEditorState(editor);
          }
        }, HISTORY_MERGE_OPTIONS);
        break;
      }
    }
  }
}
