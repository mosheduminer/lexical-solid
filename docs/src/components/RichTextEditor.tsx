import { $getRoot, $getSelection, EditorState, LexicalEditor } from "lexical";
import { LinkNode } from "@lexical/link";
import { AutoLinkNode } from "@lexical/link";
import "./RichTextEditor.css";
import {
  OnChangePlugin,
  LexicalComposer,
  ContentEditable,
  RichTextPlugin,
  LinkPlugin,
} from "lexical-solid";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
//import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { ListItemNode, ListNode } from "@lexical/list";
//@ts-ignore
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { HistoryPlugin } from "lexical-solid";
import TreeViewPlugin from "../plugins/TreeViewPlugin";
import AutoFocusPlugin from "~/plugins/AutoFocusPlugin";
import CodeHighlightPlugin from "~/plugins/CodeHighlightPlugin";
import ToolbarPlugin from "~/plugins/ToolbarPlugin";
import RichTextTheme from "./RichTextTheme";
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
  theme: RichTextTheme,
  // Handling of errors during update
  onError(error: any) {
    throw error;
  },
  // Any custom nodes go here
  nodes: [
    HeadingNode,
    ListNode,
    ListItemNode,
    QuoteNode,
    CodeNode,
    CodeHighlightNode,
//    TableNode,
//    TableCellNode,
//    TableRowNode,
    AutoLinkNode,
    LinkNode
  ] as any
};

export default function Editor() {
  return (
    <LexicalComposer initialConfig={editorConfig}>
      <div className="editor-container">
        <ToolbarPlugin />
        <div className="editor-inner">
          <RichTextPlugin
            contentEditable={<ContentEditable className="editor-input" />}
            placeholder={<Placeholder />}
          />
          <LinkPlugin />
          <AutoFocusPlugin />
          <OnChangePlugin onChange={onChange} />
          <HistoryPlugin />
          <TreeViewPlugin />
          <AutoFocusPlugin />
          <CodeHighlightPlugin />
        </div>
      </div>
    </LexicalComposer>
  );
}
