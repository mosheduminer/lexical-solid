import {
  createSignal,
  createMemo,
  JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { createComponent, isServer, Portal } from "solid-js/web";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  EditorState,
  LexicalEditor,
  RangeSelection,
  TextNode,
} from "lexical";
import text from "@lexical/text";
import clipboard from "@lexical/clipboard";
import selection from "@lexical/selection";

type InitialEditorStateType = null | string | EditorState | (() => void);

export default function PlainTextPlugin(props: {
  contentEditable: JSX.Element;
  initialEditorState?: InitialEditorStateType;
  placeholder: JSX.Element;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const showPlaceholder = useLexicalCanShowPlaceholder(editor);
  usePlainTextSetup(editor, props.initialEditorState || null);
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
    editor
      .getEditorState()
      .read(text.$canShowPlaceholderCurry(editor.isComposing()))
  );
  onCleanup(editor.addListener("update", ({ editorState }) => {
    const isComposing = editor.isComposing();
    const currentCanShowPlaceholder = editorState.read(
      text.$canShowPlaceholderCurry(isComposing)
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

  onCleanup(() => {
    editor.addListener("decorator", (nextDecorators) => {
      setDecorators(nextDecorators);
    });
  });

  return createMemo(() => {
    const decoratedPortals = [];
    const decs = decorators();
    const decoratorKeys = Object.keys(decs);

    for (let i = 0; i < decoratorKeys.length; i++) {
      const nodeKey = decoratorKeys[i];
      const decorator = decs[nodeKey];
      const element = editor.getElementByKey(nodeKey);

      if (element !== null) {
        decoratedPortals.push(
          createComponent(Portal, { mount: element, children: decorator })
        );
      }
    }

    return decoratedPortals;
  });
}

function onPasteForPlainText(event: ClipboardEvent, editor: LexicalEditor) {
  event.preventDefault();
  editor.update(() => {
    const selection = $getSelection();
    const clipboardData = event.clipboardData;

    if (clipboardData != null && $isRangeSelection(selection)) {
      clipboard.$insertDataTransferForPlainText(clipboardData, selection);
    }
  });
}
function onCutForPlainText(event: ClipboardEvent, editor: LexicalEditor) {
  onCopyForPlainText(event, editor);
  editor.update(() => {
    const selection = $getSelection();

    if ($isRangeSelection(selection)) {
      (selection as RangeSelection).removeText();
    }
  });
}
function onCopyForPlainText(event: ClipboardEvent, editor: LexicalEditor) {
  event.preventDefault();
  editor.update(() => {
    const clipboardData = event.clipboardData;
    const selection = $getSelection();

    if (selection !== null) {
      if (clipboardData != null) {
        const htmlString = clipboard.getHtmlContent(editor);

        if (htmlString !== null) {
          clipboardData.setData("text/html", htmlString);
        }

        clipboardData.setData("text/plain", selection.getTextContent());
      }
    }
  });
}

const options = {
  tag: "history-merge",
};
const setEditorOptions = options;
const updateOptions = options;
function initializeEditor(
  editor: LexicalEditor,
  initialEditorState: InitialEditorStateType
) {
  if (initialEditorState === null) {
    return;
  } else if (initialEditorState === undefined) {
    editor.update(() => {
      const root = $getRoot();
      const firstChild = root.getFirstChild();

      if (firstChild === null) {
        const paragraph = $createParagraphNode();
        root.append(paragraph);
        const activeElement = document.activeElement;

        if (
          $getSelection() !== null ||
          (activeElement !== null && activeElement === editor.getRootElement())
        ) {
          paragraph.select();
        }
      }
    }, updateOptions);
  } else if (initialEditorState !== null) {
    switch (typeof initialEditorState) {
      case "string": {
        const parsedEditorState = editor.parseEditorState(initialEditorState);
        editor.setEditorState(parsedEditorState, setEditorOptions);
        break;
      }

      case "object": {
        editor.setEditorState(initialEditorState, setEditorOptions);
        break;
      }

      case "function": {
        editor.update(initialEditorState, updateOptions);
        break;
      }
    }
  }
}

function useLexicalDragonSupport(editor: LexicalEditor) {
  const handler = (event: MessageEvent) => {
    const rootElement = editor.getRootElement();

    if (document.activeElement !== rootElement) {
      return;
    }

    const data = event.data;

    if (typeof data === "string") {
      let parsedData;

      try {
        parsedData = JSON.parse(data);
      } catch (e) {
        return;
      }

      if (
        parsedData &&
        parsedData.protocol === "nuanria_messaging" &&
        parsedData.type === "request"
      ) {
        const payload = parsedData.payload;

        if (payload && payload.functionId === "makeChanges") {
          const args = payload.args;

          if (args) {
            const [
              elementStart,
              elementLength,
              text,
              selStart,
              selLength,
              formatCommand,
            ] = args;
            editor.update(() => {
              const selection = $getSelection()!;

              if ($isRangeSelection(selection)) {
                const anchor = (selection as RangeSelection).anchor;
                let anchorNode = anchor.getNode();
                let setSelStart = 0;
                let setSelEnd = 0;

                if ($isTextNode(anchorNode)) {
                  // set initial selection
                  if (elementStart >= 0 && elementLength >= 0) {
                    setSelStart = elementStart;
                    setSelEnd = elementStart + elementLength; // If the offset is more than the end, make it the end

                    (selection as RangeSelection).setTextNodeRange(
                      anchorNode as TextNode,
                      setSelStart,
                      anchorNode as TextNode,
                      setSelEnd
                    );
                  }
                }

                if (setSelStart !== setSelEnd || text !== "") {
                  selection.insertRawText(text);
                  anchorNode = anchor.getNode();
                }

                if ($isTextNode(anchorNode)) {
                  // set final selection
                  setSelStart = selStart;
                  setSelEnd = selStart + selLength;
                  const anchorNodeTextLength = anchorNode.getTextContentSize(); // If the offset is more than the end, make it the end

                  setSelStart =
                    setSelStart > anchorNodeTextLength
                      ? anchorNodeTextLength
                      : setSelStart;
                  setSelEnd =
                    setSelEnd > anchorNodeTextLength
                      ? anchorNodeTextLength
                      : setSelEnd;
                  (selection as RangeSelection).setTextNodeRange(
                    anchorNode as TextNode,
                    setSelStart,
                    anchorNode as TextNode,
                    setSelEnd
                  );
                } // block the chrome extension from handling this event

                event.stopImmediatePropagation();
              }
            });
          }
        }
      }
    }
  };

  if (!isServer) window.addEventListener("message", handler, true);
  onCleanup(() => {
    window.removeEventListener("message", handler, true);
  });
}

function usePlainTextSetup(
  editor: LexicalEditor,
  initialEditorState: InitialEditorStateType
) {
  onMount(() => {
    const removeListener = editor.addListener(
      "command",
      (type, payload) => {
        const selection$1 = $getSelection();

        if (!$isRangeSelection(selection$1)) {
          return false;
        }

        switch (type) {
          case "deleteCharacter": {
            const isBackward = payload;
            (selection$1 as RangeSelection).deleteCharacter(isBackward);
            return true;
          }

          case "deleteWord": {
            const isBackward = payload;
            (selection$1 as RangeSelection).deleteWord(isBackward);
            return true;
          }

          case "deleteLine": {
            const isBackward = payload;
            (selection$1 as RangeSelection).deleteLine(isBackward);
            return true;
          }

          case "insertText": {
            const eventOrText = payload;

            if (typeof eventOrText === "string") {
              (selection$1 as RangeSelection).insertText(eventOrText);
            } else {
              const dataTransfer = eventOrText.dataTransfer;

              if (dataTransfer != null) {
                clipboard.$insertDataTransferForPlainText(
                  dataTransfer,
                  selection$1
                );
              } else {
                const data = eventOrText.data;

                if (data) {
                  (selection$1 as RangeSelection).insertText(data);
                }
              }
            }

            return true;
          }

          case "removeText":
            (selection$1 as RangeSelection).removeText();
            return true;

          case "insertLineBreak":
            const selectStart = payload;
            (selection$1 as RangeSelection).insertLineBreak(selectStart);
            return true;

          case "insertParagraph":
            (selection$1 as RangeSelection).insertLineBreak();
            return true;

          case "indentContent":
          case "outdentContent":
          case "insertHorizontalRule":
          case "insertImage":
          case "insertTable":
          case "formatElement":
          case "formatText": {
            return true;
          }

          case "keyArrowLeft": {
            const event = payload;
            const isHoldingShift = event.shiftKey;

            if (
              selection.$shouldOverrideDefaultCharacterSelection(
                selection$1,
                true
              )
            ) {
              event.preventDefault();
              selection.$moveCharacter(selection$1, isHoldingShift, true);
              return true;
            }

            return false;
          }

          case "keyArrowRight": {
            const event = payload;
            const isHoldingShift = event.shiftKey;

            if (
              selection.$shouldOverrideDefaultCharacterSelection(
                selection$1,
                false
              )
            ) {
              event.preventDefault();
              selection.$moveCharacter(selection$1, isHoldingShift, false);
              return true;
            }

            return false;
          }

          case "keyBackspace": {
            const event = payload;
            event.preventDefault();
            return editor.execCommand("deleteCharacter", true);
          }

          case "keyDelete": {
            const event = payload;
            event.preventDefault();
            return editor.execCommand("deleteCharacter", false);
          }

          case "keyEnter": {
            const event = payload;
            event.preventDefault();
            return editor.execCommand("insertLineBreak", undefined);
          }

          case "copy": {
            const event = payload;
            onCopyForPlainText(event, editor);
            return true;
          }

          case "cut": {
            const event = payload;
            onCutForPlainText(event, editor);
            return true;
          }

          case "paste": {
            const event = payload;
            onPasteForPlainText(event, editor);
            return true;
          }

          case "drop":
          case "dragstart": {
            // TODO: Make drag and drop work at some point.
            const event = payload;
            event.preventDefault();
            return true;
          }
        }

        return false;
      },
      0
    );
    initializeEditor(editor, initialEditorState);
    return removeListener; // We only do this for init
  });
  useLexicalDragonSupport(editor);
}
