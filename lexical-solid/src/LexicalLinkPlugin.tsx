import { LinkNode, TOGGLE_LINK_COMMAND, toggleLink } from "@lexical/link";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import {
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  PASTE_COMMAND,
} from "lexical";
import { createEffect, on, onCleanup } from "solid-js";

type Props = {
  validateUrl?: (url: string) => boolean;
};

export function LinkPlugin(props: Props): null {
  const [editor] = useLexicalComposerContext();

  createEffect(
    on(
      () => [editor, props.validateUrl],
      () => {
        if (!editor.hasNodes([LinkNode])) {
          throw new Error("LinkPlugin: LinkNode not registered on editor");
        }
        const validateUrl = props.validateUrl;
        onCleanup(
          mergeRegister(
            editor.registerCommand(
              TOGGLE_LINK_COMMAND,
              (payload) => {
                if (payload === null) {
                  toggleLink(payload);
                  return true;
                } else if (typeof payload === "string") {
                  if (validateUrl === undefined || validateUrl(payload)) {
                    toggleLink(payload);
                    return true;
                  }
                  return false;
                } else {
                  const { url, target, rel } = payload;
                  toggleLink(url, { rel, target });
                  return true;
                }
              },
              COMMAND_PRIORITY_LOW
            ),
            validateUrl !== undefined
              ? editor.registerCommand(
                  PASTE_COMMAND,
                  (event) => {
                    const selection = $getSelection();
                    if (
                      !$isRangeSelection(selection) ||
                      selection.isCollapsed() ||
                      !(event instanceof ClipboardEvent) ||
                      event.clipboardData == null
                    ) {
                      return false;
                    }
                    const clipboardText = event.clipboardData.getData("text");
                    if (!validateUrl(clipboardText)) {
                      return false;
                    }
                    // If we select nodes that are elements then avoid applying the link.
                    if (
                      !selection.getNodes().some((node) => $isElementNode(node))
                    ) {
                      editor.dispatchCommand(
                        TOGGLE_LINK_COMMAND,
                        clipboardText
                      );
                      event.preventDefault();
                      return true;
                    }
                    return false;
                  },
                  COMMAND_PRIORITY_LOW
                )
              : () => {
                  // Don't paste arbritrary text as a link when there's no validate function
                }
          )
        );
      }
    )
  );

  return null;
}
