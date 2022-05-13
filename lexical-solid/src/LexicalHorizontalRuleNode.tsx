import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  LexicalCommand,
  LexicalNode,
} from "lexical";

import { JSX } from "solid-js";

import { createCommand, DecoratorNode } from "lexical";

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

  static importDOM(): DOMConversionMap | null {
    return {
      hr: (node: Node) => ({
        conversion: convertHorizontalRuleElement,
        priority: 0,
      }),
    };
  }

  exportDOM(): DOMExportOutput {
    return { element: document.createElement("hr") };
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
