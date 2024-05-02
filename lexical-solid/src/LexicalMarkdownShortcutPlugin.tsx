import type { ElementTransformer, Transformer } from "@lexical/markdown";
import type { LexicalNode } from "lexical";

import { registerMarkdownShortcuts, TRANSFORMERS } from "@lexical/markdown";
import { useLexicalComposerContext } from "./LexicalComposerContext";

import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
} from "./LexicalHorizontalRuleNode";
import { createEffect, mergeProps, onCleanup } from "solid-js";

const HR: ElementTransformer = {
  dependencies: [HorizontalRuleNode],
  export: (node: LexicalNode) => {
    return $isHorizontalRuleNode(node) ? "***" : null;
  },
  regExp: /^(---|\*\*\*|___)\s?$/,
  replace: (parentNode, _1, _2, isImport) => {
    const line = $createHorizontalRuleNode();

    // TODO: Get rid of isImport flag
    if (isImport || parentNode.getNextSibling() != null) {
      parentNode.replace(line);
    } else {
      parentNode.insertBefore(line);
    }

    line.selectNext();
  },
  type: "element",
};

export const DEFAULT_TRANSFORMERS = [HR, ...TRANSFORMERS];

export function LexicalMarkdownShortcutPlugin(
  props: Readonly<{ transformers?: Transformer[] }>
): null {
  props = mergeProps({ transformers: DEFAULT_TRANSFORMERS }, props);
  const [editor] = useLexicalComposerContext();
  createEffect(() => {
    const cleanup = registerMarkdownShortcuts(editor, props.transformers);
    onCleanup(cleanup);
  });
  return null;
}
