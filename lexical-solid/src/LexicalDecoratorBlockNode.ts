import type { ElementFormatType, LexicalNode, NodeKey } from "lexical";
import type { JSX } from "solid-js";

import { DecoratorNode } from "lexical";

export class DecoratorBlockNode extends DecoratorNode<JSX.Element> {
  __format: ElementFormatType;

  constructor(format?: ElementFormatType, key?: NodeKey) {
    super(key);
    //@ts-ignore
    this.__format = format;
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
}
export function $isDecoratorBlockNode(node?: LexicalNode): boolean {
  return node instanceof DecoratorBlockNode;
}
