import {
  createComponent,
  createMemo,
  createSignal,
  JSX,
  onCleanup,
  Show,
} from "solid-js";
import { EditorState, LexicalEditor } from "lexical";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import { $canShowPlaceholderCurry } from "@lexical/text";
import { isServer, Portal } from "solid-js/web";
import { registerRichText } from "@lexical/rich-text";
import { mergeRegister } from "@lexical/utils";
//@ts-ignore bad typings
import { registerDragonSupport } from "@lexical/dragon";

type InitialEditorStateType = null | string | EditorState | (() => void);
function RichTextPlugin(props: {
  contentEditable: JSX.Element;
  initialEditorState?: InitialEditorStateType;
  placeholder: JSX.Element;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const showPlaceholder = useLexicalCanShowPlaceholder(editor);
  useRichTextSetup(editor, props.initialEditorState);
  const decorators = useDecorators(editor);
  return (
    <>
      {props.contentEditable}
      <Show when={showPlaceholder()}>{props.placeholder}</Show>
      {decorators()}
    </>
  );
}

function useLexicalCanShowPlaceholder(editor: LexicalEditor) {
  const [canShowPlaceholder, setCanShowPlaceholder] = createSignal(
    editor.getEditorState().read($canShowPlaceholderCurry(editor.isComposing()))
  );
  onCleanup(
    editor.registerUpdateListener(({ editorState }) => {
      const isComposing = editor.isComposing();
      const currentCanShowPlaceholder = editorState.read(
        $canShowPlaceholderCurry(isComposing)
      );
      setCanShowPlaceholder(currentCanShowPlaceholder);
    })
  );
  return canShowPlaceholder;
}

function useDecorators(editor: LexicalEditor) {
  const [decorators, setDecorators] = createSignal(
    editor.getDecorators<Element>()
  ); // Subscribe to changes

  onCleanup(
    editor.registerDecoratorListener((nextDecorators) => {
      setDecorators(nextDecorators);
    })
  );

  return createMemo(() => {
    const decoratedPortals = [];
    const decoratorKeys = Object.keys(decorators());

    for (let i = 0; i < decoratorKeys.length; i++) {
      const nodeKey = decoratorKeys[i];
      const decorator = decorators()[nodeKey];
      const element = editor.getElementByKey(nodeKey);

      if (element !== null) {
        decoratedPortals.push(
          createComponent(Portal, {
            mount: element,
            children: decorator,
          })
        );
      }
    }

    return decoratedPortals;
  });
}

function useRichTextSetup(
  editor: LexicalEditor,
  initialEditorState?: InitialEditorStateType
) {
  if (!isServer) {
    onCleanup(
      mergeRegister(
        registerRichText(editor, initialEditorState),
        registerDragonSupport(editor)
      ) // We only do this for init
    );
  }
}

export default RichTextPlugin;
