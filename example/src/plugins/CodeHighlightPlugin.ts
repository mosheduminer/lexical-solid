import { useLexicalComposerContext } from "lexical-solid/LexicalComposerContext";
import { onCleanup, onMount } from "solid-js";
//@ts-ignore
import { registerCodeHighlighting } from "@lexical/code";

export default function CodeHighlightPlugin() {
  const [editor] = useLexicalComposerContext();
  onMount(() => {
    onCleanup(registerCodeHighlighting(editor));
  });
  return null;
}
