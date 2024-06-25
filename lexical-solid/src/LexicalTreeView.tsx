import type { EditorState, LexicalEditor } from "lexical";

import {
  CustomPrintNodeFn,
  generateContent,
  TreeView as TreeViewCore,
  useLexicalCommandsLog,
} from "./devtools-core";
import { mergeRegister } from "@lexical/utils";
import { JSX } from "solid-js/jsx-runtime";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";

export function TreeView(props: {
  editor: LexicalEditor;
  treeTypeButtonClassName: string;
  timeTravelButtonClassName: string;
  timeTravelPanelButtonClassName: string;
  timeTravelPanelClassName: string;
  timeTravelPanelSliderClassName: string;
  viewClassName: string;
  customPrintNode?: CustomPrintNodeFn;
}): JSX.Element {
  const [treeElementRef, setTreeElementRef] =
    createSignal<HTMLPreElement | null>(null);
  const [editorCurrentState, setEditorCurrentState] = createSignal<EditorState>(
    props.editor.getEditorState()
  );

  const commandsLog = useLexicalCommandsLog(props.editor);

  onMount(() => {
    onCleanup(
      mergeRegister(
        props.editor.registerUpdateListener(({ editorState }) => {
          setEditorCurrentState(editorState);
        }),
        props.editor.registerEditableListener(() => {
          setEditorCurrentState(props.editor.getEditorState());
        })
      )
    );
  });

  createEffect(() => {
    const element = treeElementRef();

    if (element !== null) {
      // @ts-ignore Internal field
      element.__lexicalEditor = props.editor;

      onCleanup(() => {
        // @ts-ignore Internal field
        element.__lexicalEditor = null;
      });
    }
  });

  const handleEditorReadOnly = (isReadonly: boolean) => {
    const rootElement = props.editor.getRootElement();
    if (rootElement == null) {
      return;
    }

    rootElement.contentEditable = isReadonly ? "false" : "true";
  };

  return (
    <TreeViewCore
      treeTypeButtonClassName={props.treeTypeButtonClassName}
      timeTravelButtonClassName={props.timeTravelButtonClassName}
      timeTravelPanelSliderClassName={props.timeTravelPanelSliderClassName}
      timeTravelPanelButtonClassName={props.timeTravelPanelButtonClassName}
      viewClassName={props.viewClassName}
      timeTravelPanelClassName={props.timeTravelPanelClassName}
      setEditorReadOnly={handleEditorReadOnly}
      editorState={editorCurrentState()}
      setEditorState={(state) => props.editor.setEditorState(state)}
      generateContent={async function (exportDOM) {
        return generateContent(
          props.editor,
          commandsLog(),
          exportDOM,
          props.customPrintNode
        );
      }}
      ref={setTreeElementRef}
    />
  );
}
