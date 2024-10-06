import type { LexicalEditor } from "lexical";

import { registerList } from "@lexical/list";
import { onCleanup, onMount } from "solid-js";

export function useList(editor: LexicalEditor): void {
  onMount(() => onCleanup(registerList(editor)));
}
