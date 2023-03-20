import {
  ElementFormatType,
  NodeKey,
  $getNodeByKey,
  $getSelection,
  $isDecoratorNode,
  $isNodeSelection,
  $isRangeSelection,
  $setSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  FORMAT_ELEMENT_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
} from "lexical";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import { $isDecoratorBlockNode } from "./LexicalDecoratorBlockNode";
import { useLexicalNodeSelection } from "./useLexicalNodeSelection";
import {
  $getNearestBlockElementAncestorOrThrow,
  mergeRegister,
} from "@lexical/utils";
import { JSX } from "solid-js/jsx-runtime";
import { createEffect, onCleanup } from "solid-js";

type Props = Readonly<{
  children: JSX.Element;
  format?: ElementFormatType | null;
  nodeKey: NodeKey;
  classes: Readonly<{
    base: string;
    focus: string;
  }>;
}>;

export function BlockWithAlignableContents(props: Props): JSX.Element {
  const [editor] = useLexicalComposerContext();

  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(
    props.nodeKey
  );
  let ref: HTMLDivElement | undefined;

  const onDelete = (event: KeyboardEvent) => {
    if (isSelected() && $isNodeSelection($getSelection())) {
      event.preventDefault();
      editor.update(() => {
        const node = $getNodeByKey(props.nodeKey);
        if (node === null) return;

        $setSelection(node.selectPrevious());
        if ($isDecoratorNode(node)) {
          node.remove();
        }

        setSelected(false);
      });
    }

    return false;
  };

  createEffect(() => {
    onCleanup(
      mergeRegister(
        editor.registerCommand<ElementFormatType>(
          FORMAT_ELEMENT_COMMAND,
          (formatType) => {
            if (isSelected()) {
              const selection = $getSelection();

              if ($isNodeSelection(selection)) {
                const node = $getNodeByKey(props.nodeKey)!;

                if ($isDecoratorBlockNode(node)) {
                  node.setFormat(formatType);
                }
              } else if ($isRangeSelection(selection)) {
                const nodes = selection.getNodes();

                for (const node of nodes) {
                  if ($isDecoratorBlockNode(node)) {
                    node.setFormat(formatType);
                  } else {
                    const element =
                      $getNearestBlockElementAncestorOrThrow(node);
                    element.setFormat(formatType);
                  }
                }
              }

              return true;
            }

            return false;
          },
          COMMAND_PRIORITY_LOW
        ),
        editor.registerCommand<MouseEvent>(
          CLICK_COMMAND,
          (event) => {
            if (event.target === ref) {
              event.preventDefault();
              if (!event.shiftKey) {
                clearSelection();
              }

              setSelected(!isSelected);
              return true;
            }

            return false;
          },
          COMMAND_PRIORITY_LOW
        ),
        editor.registerCommand(
          KEY_DELETE_COMMAND,
          onDelete,
          COMMAND_PRIORITY_LOW
        ),
        editor.registerCommand(
          KEY_BACKSPACE_COMMAND,
          onDelete,
          COMMAND_PRIORITY_LOW
        )
      )
    );
  });

  return (
    <div
      classList={{
        [props.classes.base]: true,
        [props.classes.focus]: isSelected(),
      }}
      ref={ref}
      style={{
        "text-align": props.format ? props.format : undefined,
      }}
    >
      {props.children}
    </div>
  );
}
