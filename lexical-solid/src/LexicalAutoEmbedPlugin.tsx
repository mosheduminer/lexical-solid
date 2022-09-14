import type { LexicalNode, MutationListener } from "lexical";

import { $isLinkNode, AutoLinkNode, LinkNode } from "@lexical/link";
import { useLexicalComposerContext } from "./LexicalComposerContext";
import {
  LexicalNodeMenuPlugin,
  TypeaheadOption,
} from "./LexicalTypeaheadMenuPlugin";
import { mergeRegister } from "@lexical/utils";
import {
  $getNodeByKey,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  LexicalCommand,
  LexicalEditor,
  NodeKey,
  TextNode,
} from "lexical";
import {
  createEffect,
  createSignal,
  createMemo,
  VoidComponent,
  JSX,
  onCleanup,
  Show,
} from "solid-js";
import { Portal } from "solid-js/web";

export type EmbedMatchResult = {
  url: string;
  id: string;
};

export interface EmbedConfig {
  // Used to identify this config e.g. youtube, tweet, google-maps.
  type: string;
  // Determine if a given URL is a match and return url data.
  parseUrl: (text: string) => EmbedMatchResult | null;
  // Create the Lexical embed node from the url data.
  insertNode: (editor: LexicalEditor, result: EmbedMatchResult) => void;
}

export const URL_MATCHER =
  /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;

export const INSERT_EMBED_COMMAND: LexicalCommand<EmbedConfig["type"]> =
  createCommand();

export type EmbedMenuProps = {
  selectedItemIndex: number | null;
  onOptionClick: (option: AutoEmbedOption, index: number) => void;
  onOptionMouseEnter: (index: number) => void;
  options: Array<AutoEmbedOption>;
};

export type EmbedMenuComponent = VoidComponent<EmbedMenuProps>;

export class AutoEmbedOption extends TypeaheadOption {
  title: string;
  icon?: JSX.Element;
  onSelect: (targetNode: LexicalNode | null) => void;
  constructor(
    title: string,
    options: {
      icon?: JSX.Element;
      onSelect: (targetNode: LexicalNode | null) => void;
    }
  ) {
    super(title);
    this.title = title;
    this.icon = options.icon;
    this.onSelect = options.onSelect.bind(this);
  }
}

type LexicalAutoEmbedPluginProps<TEmbedConfig extends EmbedConfig> = {
  embedConfigs: Array<TEmbedConfig>;
  onOpenEmbedModalForConfig: (embedConfig: TEmbedConfig) => void;
  menuComponent: EmbedMenuComponent;
  getMenuOptions: (
    activeEmbedConfig: TEmbedConfig,
    embedFn: () => void,
    dismissFn: () => void
  ) => Array<AutoEmbedOption>;
};

export function LexicalAutoEmbedPlugin<TEmbedConfig extends EmbedConfig>(
  props: LexicalAutoEmbedPluginProps<TEmbedConfig>
): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  const [nodeKey, setNodeKey] = createSignal<NodeKey | null>(null);
  const [activeEmbedConfig, setActiveEmbedConfig] =
    createSignal<TEmbedConfig | null>(null);

  const reset = () => {
    setNodeKey(null);
    setActiveEmbedConfig(null);
  };

  const checkIfLinkNodeIsEmbeddable = (key: NodeKey) => {
    editor.getEditorState().read(() => {
      const linkNode = $getNodeByKey(key);
      if ($isLinkNode(linkNode)) {
        const embedConfigMatch = props.embedConfigs.find((embedConfig) =>
          embedConfig.parseUrl(linkNode.__url)
        );
        if (embedConfigMatch != null) {
          setActiveEmbedConfig(() => embedConfigMatch);
          setNodeKey(linkNode.getKey());
        }
      }
    });
  };

  createEffect(() => {
    const listener: MutationListener = (
      nodeMutations,
      { updateTags, dirtyLeaves }
    ) => {
      for (const [key, mutation] of nodeMutations) {
        if (
          mutation === "created" &&
          updateTags.has("paste") &&
          dirtyLeaves.size === 1
        ) {
          checkIfLinkNodeIsEmbeddable(key);
        } else if (key === nodeKey()) {
          reset();
        }
      }
    };
    onCleanup(
      mergeRegister(
        ...[LinkNode, AutoLinkNode].map((Klass) =>
          editor.registerMutationListener(Klass, (...args) => listener(...args))
        )
      )
    );
  });

  createEffect(() => {
    onCleanup(
      editor.registerCommand(
        INSERT_EMBED_COMMAND,
        (embedConfigType: TEmbedConfig["type"]) => {
          const embedConfig = props.embedConfigs.find(
            ({ type }) => type === embedConfigType
          );
          if (embedConfig) {
            props.onOpenEmbedModalForConfig(embedConfig);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_EDITOR
      )
    );
  });

  const embedLinkViaActiveEmbedConfig = () => {
    if (activeEmbedConfig() != null && nodeKey() != null) {
      const linkNode = editor.getEditorState().read(() => {
        const node = $getNodeByKey(nodeKey()!);
        if ($isLinkNode(node)) {
          return node;
        }
        return null;
      });
      if ($isLinkNode(linkNode)) {
        const result = activeEmbedConfig()!.parseUrl(linkNode.__url);
        if (result != null) {
          editor.update(() => {
            activeEmbedConfig()!.insertNode(editor, result);
          });
          if (linkNode.isAttached()) {
            editor.update(() => {
              linkNode.remove();
            });
          }
        }
      }
    }
  };

  const options = createMemo(() => {
    return activeEmbedConfig != null && nodeKey != null
      ? props.getMenuOptions(
          activeEmbedConfig()!,
          embedLinkViaActiveEmbedConfig,
          reset
        )
      : [];
  });

  const onSelectOption = (
    selectedOption: AutoEmbedOption,
    targetNode: TextNode | null,
    closeMenu: () => void
  ) => {
    editor.update(() => {
      selectedOption.onSelect(targetNode);
      closeMenu();
    });
  };

  return (
    <Show when={nodeKey() != null}>
      <LexicalNodeMenuPlugin<AutoEmbedOption>
        nodeKey={nodeKey()}
        onClose={reset}
        onSelectOption={onSelectOption}
        options={options()}
        menuRenderFn={(
          anchorElement,
          { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }
        ) => (
          <Show when={anchorElement() && nodeKey() != null}>
            <Portal mount={anchorElement()!}>
              <props.menuComponent
                options={options()}
                selectedItemIndex={selectedIndex()}
                onOptionClick={(option: AutoEmbedOption, index: number) => {
                  setHighlightedIndex(index);
                  selectOptionAndCleanUp(option);
                }}
                onOptionMouseEnter={(index: number) => {
                  setHighlightedIndex(index);
                }}
              />
            </Portal>
          </Show>
        )}
      />
    </Show>
  );
}
