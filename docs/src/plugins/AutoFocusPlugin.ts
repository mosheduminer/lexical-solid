// Lexical Solid plugins are Solid components, which makes them
// highly composable. Furthermore, you can lazy load plugins if
// desired, so you don't pay the cost for plugins until you

import { useLexicalComposerContext } from "lexical-solid";
import { onMount } from "solid-js";

// actually use them.
export default function AutoFocusPlugin() {
  const [editor] = useLexicalComposerContext();

  onMount(() => {
    // Focus the editor when the effect fires!
    editor.focus();
  });

  return null;
}