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
      ...super.exportJSON(),
      format: this.__format || "",
    };
  }

  canIndent(): false {
    return false;
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
export function $isDecoratorBlockNode(
  node?: LexicalNode
): node is DecoratorBlockNode {
  return node instanceof DecoratorBlockNode;
}
