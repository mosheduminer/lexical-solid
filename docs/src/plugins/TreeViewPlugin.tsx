import { useLexicalComposerContext } from "lexical-solid/LexicalComposerContext";
import LexicalTreeView from "lexical-solid/LexicalTreeView";

export default function TreeViewPlugin() {
  const [editor] = useLexicalComposerContext();
  return (
    <LexicalTreeView
      viewClass="tree-view-output"
      timeTravelPanelClass="debug-timetravel-panel"
      timeTravelButtonClass="debug-timetravel-button"
      timeTravelPanelSliderClass="debug-timetravel-panel-slider"
      timeTravelPanelButtonClass="debug-timetravel-panel-button"
      editor={editor}
    />
  );
}
