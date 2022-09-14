import { useLexicalComposerContext } from "./LexicalComposerContext";
import { toggleLink, LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { onCleanup, onMount } from "solid-js";
import { COMMAND_PRIORITY_EDITOR } from "lexical";

export function LinkPlugin() {
  const [editor] = useLexicalComposerContext();
  onMount(() => {
    if (!editor.hasNodes([LinkNode])) {
      throw new Error("LinkPlugin: LinkNode not registered on editor");
    }
  });
  onCleanup(
    editor.registerCommand(
      TOGGLE_LINK_COMMAND,
      (payload) => {
        if (typeof payload === "string" || payload === null) {
          toggleLink(payload);
        } else {
          const { url, target, rel } = payload;
          toggleLink(url, { rel, target });
        }
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    )
  );
  return null;
}
