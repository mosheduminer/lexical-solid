import { useLexicalComposerContext } from "./LexicalComposerContext";
import { onMount } from "solid-js";

export default function LexicalAutoFocusPlugin(): null {
  const [editor] = useLexicalComposerContext();

  onMount(() => {
    editor.focus();
  });

  return null;
}
