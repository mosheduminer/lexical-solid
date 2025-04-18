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

/**
 * TreeView is a React component that provides a visual representation of
 * the Lexical editor's state and enables debugging features like time travel
 * and custom tree node rendering.
 *
 * @param {Object} props - The properties passed to the TreeView component.
 * @param {LexicalEditor} props.editor - The Lexical editor instance to be visualized and debugged.
 * @param {string} [props.treeTypeButtonClassName] - Custom class name for the tree type toggle button.
 * @param {string} [props.timeTravelButtonClassName] - Custom class name for the time travel toggle button.
 * @param {string} [props.timeTravelPanelButtonClassName] - Custom class name for buttons inside the time travel panel.
 * @param {string} [props.timeTravelPanelClassName] - Custom class name for the overall time travel panel container.
 * @param {string} [props.timeTravelPanelSliderClassName] - Custom class name for the time travel slider in the panel.
 * @param {string} [props.viewClassName] - Custom class name for the tree view container.
 * @param {CustomPrintNodeFn} [props.customPrintNode] - A function for customizing the display of nodes in the tree.
 *
 * @returns {JSX.Element} - A React element that visualizes the editor's state and supports debugging interactions.
 */

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
    // Registers listeners to update the tree view when the editor state changes
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
      // Assigns the editor instance to the tree view DOM element for internal tracking
      // @ts-ignore Internal field used by Lexical
      element.__lexicalEditor = props.editor;

      onCleanup(() => {
        // Cleans up the reference when the component is unmounted
        // @ts-ignore Internal field used by Lexical
        element.__lexicalEditor = null;
      });
    }
  });

  /**
   * Handles toggling the readonly state of the editor.
   *
   * @param {boolean} isReadonly - Whether the editor should be set to readonly.
   */
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
        // Generates the content for the tree view, allowing customization with exportDOM and customPrintNode
        return generateContent(
          props.editor,
          commandsLog(),
          exportDOM,
          props.customPrintNode
        );
      }}
      ref={setTreeElementRef}
      commandsLog={commandsLog()}
    />
  );
}
