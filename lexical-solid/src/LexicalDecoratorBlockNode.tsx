import type {
  ElementFormatType,
  LexicalNode,
  LexicalUpdateJSON,
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

  updateFromJSON(
    serializedNode: LexicalUpdateJSON<SerializedDecoratorBlockNode>
  ): this {
    return super
      .updateFromJSON(serializedNode)
      .setFormat(serializedNode.format || "");
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

  setFormat(format: ElementFormatType): this {
    const self = this.getWritable();
    self.__format = format;
    return self;
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
