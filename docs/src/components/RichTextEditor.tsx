import { $getRoot, $getSelection, EditorState, LexicalEditor } from "lexical";
import { LinkNode } from "@lexical/link";
import { AutoLinkNode } from "@lexical/link";

import ExampleTheme from "../themes/PlainTextTheme";
import {
  OnChangePlugin,
  LexicalComposer,
  ContentEditable,
  RichTextPlugin,
  LinkPlugin,
  LexicalAutoLinkPlugin,
} from "lexical-solid";
import { HistoryPlugin } from "lexical-solid";
import TreeViewPlugin from "../plugins/TreeViewPlugin";
import { onMount } from "solid-js";
import AutoFocusPlugin from "~/plugins/AutoFocusPlugin";
//import { EmojiNode } from "./nodes/EmojiNode";
//import EmoticonPlugin from "./plugins/EmoticonPlugin";

function Placeholder() {
  return <div class="editor-placeholder">Enter some plain text...</div>;
}

// When the editor changes, you can get notified via the
// LexicalOnChangePlugin!
function onChange(editorState: EditorState, editor: LexicalEditor) {
  editorState.read(() => {
    // Read the contents of the EditorState here.
    const root = $getRoot();
    const selection = $getSelection();

    console.log(root, selection);
  });
}


const editorConfig = {
  // The editor theme
  theme: ExampleTheme,
  // Handling of errors during update
  onError(error: any) {
    throw error;
  },
  // Any custom nodes go here
  nodes: [AutoLinkNode, LinkNode] as any
};

export default function Editor() {
  return (
    <LexicalComposer initialConfig={editorConfig}>
      <div className="editor-container">
        <RichTextPlugin
          contentEditable={<ContentEditable className="editor-input" />}
          placeholder={<Placeholder />}
        />
        <LinkPlugin />
        <AutoFocusPlugin />
        <OnChangePlugin onChange={onChange} />
        <HistoryPlugin />
        <TreeViewPlugin />
      </div>
    </LexicalComposer>
  );
}
