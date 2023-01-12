import type { EntityMatch } from "@lexical/text";
import type { Klass, TextNode } from "lexical";

import { useLexicalComposerContext } from "./LexicalComposerContext";
import { registerLexicalTextEntity } from "@lexical/text";
import { mergeRegister } from "@lexical/utils";
import { onCleanup } from "solid-js";

export function useLexicalTextEntity<T extends TextNode>(
  getMatch: (text: string) => null | EntityMatch,
  targetNode: Klass<T>,
  createNode: (textNode: TextNode) => T
): void {
  const [editor] = useLexicalComposerContext();

  onCleanup(
    mergeRegister(
      ...registerLexicalTextEntity(editor, getMatch, targetNode, createNode)
    )
  );
}
