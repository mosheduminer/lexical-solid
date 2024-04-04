import type {
  MenuRenderFn,
  MenuResolution,
  MutableRefObject,
} from "./shared/LexicalMenu";

import { useLexicalComposerContext } from "./LexicalComposerContext";
import {
  COMMAND_PRIORITY_LOW,
  CommandListenerPriority,
  LexicalNode,
} from "lexical";
import {
  createEffect,
  createSignal,
  onCleanup,
  type JSX,
  Show,
  Accessor,
} from "solid-js";

import {
  LexicalMenu,
  MenuOption,
  useMenuAnchorRef,
} from "./shared/LexicalMenu";
import { calculateZoomLevel } from "@lexical/utils";

export type ContextMenuRenderFn<TOption extends MenuOption> = (
  anchorElementRef: MutableRefObject<HTMLElement | null | undefined>,
  itemProps: {
    selectedIndex: Accessor<number | null>;
    selectOptionAndCleanUp: (option: TOption) => void;
    setHighlightedIndex: (index: number) => void;
    options: Array<TOption>;
  },
  menuProps: {
    setMenuRef: (element: HTMLElement | null) => void;
  }
) => JSX.Element;

export type LexicalContextMenuPluginProps<TOption extends MenuOption> = {
  onSelectOption: (
    option: TOption,
    textNodeContainingQuery: LexicalNode | null,
    closeMenu: () => void,
    matchingString: string
  ) => void;
  options: Array<TOption>;
  onClose?: () => void;
  onWillOpen?: (event: MouseEvent) => void;
  onOpen?: (resolution: MenuResolution) => void;
  menuRenderFn: ContextMenuRenderFn<TOption>;
  anchorClassName?: string;
  commandPriority?: CommandListenerPriority;
  parent?: HTMLElement;
};

const PRE_PORTAL_DIV_SIZE = 1;

export function LexicalContextMenuPlugin<TOption extends MenuOption>(
  props: LexicalContextMenuPluginProps<TOption>
): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [resolution, setResolution] = createSignal<MenuResolution | null>(null);
  const menuRef: MutableRefObject<HTMLElement | null> = { current: null };

  const anchorElementRef = useMenuAnchorRef(
    resolution,
    setResolution,
    props.anchorClassName,
    props.parent
  );

  const closeNodeMenu = () => {
    if (props.onClose != null && resolution() !== null) {
      props.onClose();
    }
    setResolution(null);
  };

  const openNodeMenu = (res: MenuResolution) => {
    const onOpen = props.onOpen;
    if (onOpen != null && resolution() === null) {
      onOpen(res);
    }
    setResolution(res);
  };

  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    const onWillOpen = props.onWillOpen;
    if (onWillOpen != null) {
      onWillOpen(event);
    }
    const zoom = calculateZoomLevel(event.target as Element);
    openNodeMenu({
      getRect: () =>
        new DOMRect(
          event.clientX / zoom,
          event.clientY / zoom,
          PRE_PORTAL_DIV_SIZE,
          PRE_PORTAL_DIV_SIZE
        ),
    });
  };
  const handleClick = (event: MouseEvent) => {
    if (
      resolution() !== null &&
      menuRef.current != null &&
      event.target != null &&
      !menuRef.current.contains(event.target as Node)
    ) {
      closeNodeMenu();
    }
  };

  createEffect(() => {
    const editorElement = editor.getRootElement();
    if (editorElement) {
      editorElement.addEventListener("contextmenu", handleContextMenu);
      onCleanup(() =>
        editorElement.removeEventListener("contextmenu", handleContextMenu)
      );
    }
  });

  createEffect(() => {
    document.addEventListener("click", handleClick);
    onCleanup(() => document.removeEventListener("click", handleClick));
  });

  return (
    <Show when={resolution() !== null && editor !== null}>
      <LexicalMenu
        close={closeNodeMenu}
        resolution={resolution()!}
        editor={editor}
        anchorElementRef={anchorElementRef}
        options={props.options}
        menuRenderFn={(anchorRef, itemProps) =>
          props.menuRenderFn(anchorRef, itemProps, {
            setMenuRef: (ref) => {
              menuRef.current = ref;
            },
          })
        }
        onSelectOption={props.onSelectOption}
        commandPriority={props.commandPriority ?? COMMAND_PRIORITY_LOW}
      />
    </Show>
  );
}

export { MenuOption, MenuRenderFn, MenuResolution };
