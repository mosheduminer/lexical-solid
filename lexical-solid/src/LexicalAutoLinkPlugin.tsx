import { Accessor, createEffect, JSX, onCleanup } from "solid-js";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import {
  $createAutoLinkNode,
  $isAutoLinkNode,
  AutoLinkNode,
} from "@lexical/link";
import {
  $createTextNode,
  $isElementNode,
  $isLineBreakNode,
  $isTextNode,
  ElementNode,
  LexicalEditor,
  LexicalNode,
  TextNode,
} from "lexical";
import { Class } from "utility-types";
import { mergeRegister } from "@lexical/utils";
import { $isLinkNode } from "@lexical/link";
import { isServer } from "solid-js/web";

type ChangeHandler = (url: string | null, prevUrl: string | null) => void;
type LinkMatcherResult = {
  text: string;
  url: string;
  length: number;
  index: number;
};
type LinkMatcher = (text: string) => LinkMatcherResult | null;
function LexicalAutoLinkPlugin(props: {
  matchers: LinkMatcher[];
  onChange?: ChangeHandler;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  useAutoLink(
    editor,
    () => props.matchers,
    () => props.onChange
  );
  return null;
}

function findFirstMatch(text: string, matchers: LinkMatcher[]) {
  for (let i = 0; i < matchers.length; i++) {
    const match = matchers[i](text);

    if (match) {
      return match;
    }
  }

  return null;
}

function isPreviousNodeValid(node: LexicalNode) {
  let previousNode = node.getPreviousSibling();

  if ($isElementNode(previousNode)) {
    previousNode = (previousNode as ElementNode).getLastDescendant();
  }

  return (
    previousNode === null ||
    $isLineBreakNode(previousNode) ||
    ($isTextNode(previousNode) && previousNode.getTextContent().endsWith(" "))
  );
}

function isNextNodeValid(node: LexicalNode) {
  let nextNode = node.getNextSibling();

  if ($isElementNode(nextNode)) {
    nextNode = (nextNode as ElementNode).getFirstDescendant();
  }

  return (
    nextNode === null ||
    $isLineBreakNode(nextNode) ||
    ($isTextNode(nextNode) && nextNode.getTextContent().startsWith(" "))
  );
}

function handleLinkCreation(
  node: TextNode,
  matchers: LinkMatcher[],
  onChange: ChangeHandler
) {
  const nodeText = node.getTextContent();
  const nodeTextLength = nodeText.length;
  let text = nodeText;
  let textOffset = 0;
  let lastNode = node;
  let lastNodeOffset = 0;
  let match;

  while ((match = findFirstMatch(text, matchers)) && match !== null) {
    const matchOffset = match.index;
    const offset = textOffset + matchOffset;
    const matchLength = match.length; // Previous node is valid if any of:
    // 1. Space before same node
    // 2. Space in previous simple text node
    // 3. Previous node is LineBreakNode

    let contentBeforeMatchIsValid;

    if (offset > 0) {
      contentBeforeMatchIsValid = nodeText[offset - 1] === " ";
    } else {
      contentBeforeMatchIsValid = isPreviousNodeValid(node);
    } // Next node is valid if any of:
    // 1. Space after same node
    // 2. Space in next simple text node
    // 3. Next node is LineBreakNode

    let contentAfterMatchIsValid;

    if (offset + matchLength < nodeTextLength) {
      contentAfterMatchIsValid = nodeText[offset + matchLength] === " ";
    } else {
      contentAfterMatchIsValid = isNextNodeValid(node);
    }

    if (contentBeforeMatchIsValid && contentAfterMatchIsValid) {
      let middleNode;

      if (matchOffset === 0) {
        [middleNode, lastNode] = lastNode.splitText(matchLength);
      } else {
        [, middleNode, lastNode] = lastNode.splitText(
          matchOffset,
          matchOffset + matchLength
        );
      }

      const linkNode = $createAutoLinkNode(match.url);
      //@ts-ignore
      linkNode.append($createTextNode(match.text));
      //@ts-ignore
      middleNode.replace(linkNode);
      onChange(match.url, null);
    }

    const iterationOffset = matchOffset + matchLength;
    text = text.substring(iterationOffset);
    textOffset += iterationOffset;
  }
}

function handleLinkEdit(
  linkNode: AutoLinkNode,
  matchers: LinkMatcher[],
  onChange: ChangeHandler
) {
  // Check children are simple text
  const children = (linkNode as unknown as ElementNode).getChildren();
  const childrenLength = children.length;

  for (let i = 0; i < childrenLength; i++) {
    const child = children[i];

    if (
      !$isTextNode(child as unknown as LexicalNode) ||
      !(child as unknown as TextNode).isSimpleText()
    ) {
      replaceWithChildren(linkNode as unknown as ElementNode);
      onChange(null, linkNode.getURL());
      return;
    }
  } // Check text content fully matches

  const text = (linkNode as unknown as ElementNode).getTextContent();
  const match = findFirstMatch(text, matchers);

  if (match === null || match.text !== text) {
    replaceWithChildren(linkNode as unknown as ElementNode);
    onChange(null, linkNode.getURL());
    return;
  } // Check neighbors

  if (
    !isPreviousNodeValid(linkNode as unknown as LexicalNode) ||
    !isNextNodeValid(linkNode as unknown as LexicalNode)
  ) {
    replaceWithChildren(linkNode as unknown as ElementNode);
    onChange(null, linkNode.getURL());
    return;
  }

  const url = linkNode.getURL();

  if (match !== null && url !== match.url) {
    linkNode.setURL(match.url);
    onChange(match.url, url);
  }
} // Bad neighbours are edits in neighbor nodes that make AutoLinks incompatible.
// Given the creation preconditions, these can only be simple text nodes.

function handleBadNeighbors(textNode: TextNode, onChange: ChangeHandler) {
  const previousSibling = textNode.getPreviousSibling();
  const nextSibling = textNode.getNextSibling();
  const text = textNode.getTextContent();

  if ($isAutoLinkNode(previousSibling) && !text.startsWith(" ")) {
    replaceWithChildren(previousSibling as ElementNode);
    onChange(null, (previousSibling as unknown as AutoLinkNode).getURL());
  }

  if ($isAutoLinkNode(nextSibling) && !text.endsWith(" ")) {
    replaceWithChildren(nextSibling as ElementNode);
    onChange(null, (nextSibling as unknown as AutoLinkNode).getURL());
  }
}

function replaceWithChildren(node: ElementNode) {
  const children = node.getChildren();
  const childrenLength = children.length;

  for (let j = childrenLength - 1; j >= 0; j--) {
    node.insertAfter(children[j]);
  }

  node.remove();
  return children.map((child) => child.getLatest());
}

function useAutoLink(
  editor: LexicalEditor,
  matchersAccessor: Accessor<LinkMatcher[]>,
  onChangeAccessor: Accessor<ChangeHandler | undefined>
) {
  createEffect(() => {
    const onChange = onChangeAccessor();
    const matchers = matchersAccessor();
    if (!editor.hasNodes([AutoLinkNode] as unknown as Class<LexicalNode>[])) {
      throw Error(
        `LexicalAutoLinkPlugin: AutoLinkNode, TableCellNode or TableRowNode not registered on editor`
      );
    }

    const onChangeWrapped: ChangeHandler = (...args) => {
      if (onChange) {
        onChange(...args);
      }
    };

    if (!isServer) {
      onCleanup(
        mergeRegister(
          editor.registerNodeTransform(TextNode, (textNode) => {
            const parent = textNode.getParentOrThrow();

            if ($isAutoLinkNode(parent)) {
              handleLinkEdit(
                parent as unknown as AutoLinkNode,
                matchers,
                onChangeWrapped
              );
            } else if (!$isLinkNode(parent)) {
              if (textNode.isSimpleText()) {
                handleLinkCreation(textNode, matchers, onChangeWrapped);
              }

              handleBadNeighbors(textNode, onChangeWrapped);
            }
          }),
          editor.registerNodeTransform(
            AutoLinkNode as unknown as Class<LexicalNode>,
            (linkNode) => {
              handleLinkEdit(
                linkNode as unknown as AutoLinkNode,
                matchers,
                onChangeWrapped
              );
            }
          )
        )
      );
    }
  });
}

export type { LinkMatcher };
export default LexicalAutoLinkPlugin;
