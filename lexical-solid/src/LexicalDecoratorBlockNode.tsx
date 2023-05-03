import type {
  ElementFormatType,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import type { JSX } from "solid-js";

import { DecoratorNode } from "lexical";

export type SerializedDecoratorBlockNode = Spread<
  {
    format: ElementFormatType;
  },
  SerializedLexicalNode
>;

export class DecoratorBlockNode extends DecoratorNode<JSX.Element> {
  __format: ElementFormatType;

  constructor(format?: ElementFormatType, key?: NodeKey) {
    super(key);
    //@ts-ignore
    this.__format = format;
  }

  exportJSON(): SerializedDecoratorBlockNode {
    return {
      format: this.__format || "",
      type: "decorator-block",
      version: 1,
    };
  }

  createDOM(): HTMLElement {
    return document.createElement("div");
  }

  updateDOM(): false {
    return false;
  }

  setFormat(format: ElementFormatType): void {
    const self = this.getWritable();
    //@ts-ignore
    self.__format = format;
  }

  isInline(): false {
    return false;
  }
}
export function $isDecoratorBlockNode(node?: LexicalNode): boolean {
  return node instanceof DecoratorBlockNode;
}
