import type { EntityMatch } from "@lexical/text";
import type { TextNode } from "lexical";

import { useLexicalComposerContext } from "./LexicalComposerContext";
import { registerLexicalTextEntity } from "@lexical/text";
import { mergeRegister } from "@lexical/utils";
import { Class } from "utility-types";
import { onCleanup } from "solid-js";

export default function useLexicalTextEntity<N extends TextNode>(
  getMatch: (text: string) => null | EntityMatch,
  targetNode: Class<N>,
  createNode: (textNode: TextNode) => N
): void {
  const [editor] = useLexicalComposerContext();

  onCleanup(
    mergeRegister(
      ...registerLexicalTextEntity(editor, getMatch, targetNode, createNode)
    )
  );
}
