import {
  $applyNodeReplacement,
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  LexicalCommand,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
} from "lexical";

import { createEffect, JSX, onCleanup } from "solid-js";

import { createCommand, DecoratorNode } from "lexical";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import { useLexicalNodeSelection } from "./useLexicalNodeSelection";
import {
  addClassNamesToElement,
  mergeRegister,
  removeClassNamesFromElement,
} from "@lexical/utils";

export type SerializedHorizontalRuleNode = SerializedLexicalNode;

export const INSERT_HORIZONTAL_RULE_COMMAND: LexicalCommand<void> =
  createCommand("INSERT_HORIZONTAL_RULE_COMMAND");

function HorizontalRuleComponent(props: { nodeKey: NodeKey }) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(
    props.nodeKey
  );

  const $onDelete = (payload: KeyboardEvent) => {
    if (isSelected() && $isNodeSelection($getSelection())) {
      const event: KeyboardEvent = payload;
      event.preventDefault();
      const node = $getNodeByKey(props.nodeKey)!;
      if ($isHorizontalRuleNode(node)) {
        node.remove();
        return true;
      }
      setSelected(false);
    }
    return false;
  };

  createEffect(() => {
    onCleanup(
      mergeRegister(
        editor.registerCommand(
          CLICK_COMMAND,
          (event: MouseEvent) => {
            const hrElem = editor.getElementByKey(props.nodeKey);

            if (event.target === hrElem) {
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
          $onDelete,
          COMMAND_PRIORITY_LOW
        ),
        editor.registerCommand(
          KEY_BACKSPACE_COMMAND,
          $onDelete,
          COMMAND_PRIORITY_LOW
        )
      )
    );
  });

  createEffect(() => {
    const hrElem = editor.getElementByKey(props.nodeKey);
    const isSelectedClassName = "selected";
    if (hrElem !== null) {
      if (isSelected()) {
        addClassNamesToElement(hrElem, isSelectedClassName);
      } else {
        removeClassNamesFromElement(hrElem, isSelectedClassName);
      }
    }
  });

  return null;
}

export class HorizontalRuleNode extends DecoratorNode<JSX.Element> {
  static getType(): string {
    return "horizontalrule";
  }

  static clone(node: HorizontalRuleNode): HorizontalRuleNode {
    return new HorizontalRuleNode(node.__key);
  }

  static importJSON(
    serializedNode: SerializedHorizontalRuleNode
  ): HorizontalRuleNode {
    return $createHorizontalRuleNode();
  }

  static importDOM(): DOMConversionMap | null {
    return {
      hr: () => ({
        conversion: $convertHorizontalRuleElement,
        priority: 0,
      }),
    };
  }

  exportJSON(): SerializedLexicalNode {
    return {
      type: "horizontalrule",
      version: 1,
    };
  }

  exportDOM(): DOMExportOutput {
    return { element: document.createElement("hr") };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement("hr");
    addClassNamesToElement(element, config.theme.hr);
    return element;
  }

  getTextContent(): string {
    return "\n";
  }

  isInline(): false {
    return false;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(): JSX.Element {
    return <HorizontalRuleComponent nodeKey={this.__key} />;
  }
}

function $convertHorizontalRuleElement(): DOMConversionOutput {
  return { node: $createHorizontalRuleNode() };
}

export function $createHorizontalRuleNode(): HorizontalRuleNode {
  return $applyNodeReplacement(new HorizontalRuleNode());
}

export function $isHorizontalRuleNode(
  node: LexicalNode | undefined | null
): boolean {
  return node instanceof HorizontalRuleNode;
}
