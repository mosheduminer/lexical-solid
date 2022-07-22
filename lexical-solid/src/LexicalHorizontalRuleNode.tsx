import type {
  DOMConversionOutput,
  LexicalCommand,
  LexicalNode,
  SerializedLexicalNode,
} from "lexical";

import { JSX } from "solid-js";

import { createCommand, DecoratorNode } from "lexical";

export type SerializedHorizontalRuleNode = SerializedLexicalNode & {
  type: 'horizontalrule';
  version: 1;
};

export const INSERT_HORIZONTAL_RULE_COMMAND: LexicalCommand<void> =
  createCommand();

function HorizontalRuleComponent() {
  return <hr />;
}

export class HorizontalRuleNode extends DecoratorNode<JSX.Element> {
  static getType(): string {
    return "horizontalrule";
  }

  static clone(node: HorizontalRuleNode): HorizontalRuleNode {
    return new HorizontalRuleNode(node.__key);
  }

  static importJSON(
    serializedNode: SerializedHorizontalRuleNode,
  ): HorizontalRuleNode {
    return $createHorizontalRuleNode();
  }

  exportJSON(): SerializedLexicalNode {
    return {
      type: 'horizontalrule',
      version: 1,
    };
  }

  createDOM(): HTMLElement {
    const div = document.createElement("div");
    div.style.display = "contents";
    return div;
  }

  getTextContent(): "\n" {
    return "\n";
  }

  isTopLevel(): true {
    return true;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): JSX.Element {
    return <HorizontalRuleComponent />;
  }
}

function convertHorizontalRuleElement(): DOMConversionOutput {
  return { node: $createHorizontalRuleNode() };
}

export function $createHorizontalRuleNode(): HorizontalRuleNode {
  return new HorizontalRuleNode();
}

export function $isHorizontalRuleNode(
  node: LexicalNode | undefined | null
): boolean {
  return node instanceof HorizontalRuleNode;
}
