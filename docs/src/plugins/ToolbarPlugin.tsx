//TODO: update and fix this
import { useLexicalComposerContext } from "lexical-solid/LexicalComposerContext";
import {
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $getNodeByKey,
  RangeSelection,
  ElementNode,
  LexicalNode,
  LexicalEditor,
} from "lexical";
import { $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  $isParentElementRTL,
  $wrapLeafNodesInElements,
  $isAtNodeEnd,
} from "@lexical/selection";
import { $getNearestNodeOfType, mergeRegister } from "@lexical/utils";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  $isListNode,
  ListNode,
} from "@lexical/list";
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
} from "@lexical/rich-text";
import {
  $createCodeNode,
  $isCodeNode,
  getDefaultCodeLanguage,
  getCodeLanguages,
} from "@lexical/code";
import { Portal } from "solid-js/web";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  JSX,
  onCleanup,
  onMount,
} from "solid-js";

const LowPriority = 1;

const supportedBlockTypes = new Set([
  "paragraph",
  "quote",
  "code",
  "h1",
  "h2",
  "ul",
  "ol",
]);

const blockTypeToBlockName = {
  code: "Code Block",
  h1: "Large Heading",
  h2: "Small Heading",
  h3: "Heading",
  h4: "Heading",
  h5: "Heading",
  ol: "Numbered List",
  paragraph: "Normal",
  quote: "Quote",
  ul: "Bulleted List",
};

function Divider() {
  return <div class="divider" />;
}

function positionEditorElement(editor, rect) {
  if (rect === null) {
    editor.style.opacity = "0";
    editor.style.top = "-1000px";
    editor.style.left = "-1000px";
  } else {
    editor.style.opacity = "1";
    editor.style.top = `${rect.top + rect.height + window.pageYOffset + 10}px`;
    editor.style.left = `${rect.left + window.pageXOffset - editor.offsetWidth / 2 + rect.width / 2
      }px`;
  }
}

function FloatingLinkEditor({ editor }) {
  let editorRef!: HTMLDivElement;
  let inputRef!: HTMLInputElement;
  const mouseDownRef = false;
  const [linkUrl, setLinkUrl] = createSignal("");
  const [isEditMode, setEditMode] = createSignal(false);
  const [lastSelection, setLastSelection] = createSignal(null);

  const updateLinkEditor = () => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const node = getSelectedNode(selection);
      const parent = node.getParent();
      if ($isLinkNode(parent)) {
        setLinkUrl(parent.getURL());
      } else if ($isLinkNode(node)) {
        setLinkUrl(node.getURL());
      } else {
        setLinkUrl("");
      }
    }
    const editorElem = editorRef;
    const nativeSelection = window.getSelection();
    const activeElement = document.activeElement;

    if (editorElem === null) {
      return;
    }

    const rootElement = editor.getRootElement();
    if (
      selection !== null &&
      !nativeSelection.isCollapsed &&
      rootElement !== null &&
      rootElement.contains(nativeSelection.anchorNode)
    ) {
      const domRange = nativeSelection.getRangeAt(0);
      let rect;
      if (nativeSelection.anchorNode === rootElement) {
        let inner = rootElement;
        while (inner.firstElementChild != null) {
          inner = inner.firstElementChild;
        }
        rect = inner.getBoundingClientRect();
      } else {
        rect = domRange.getBoundingClientRect();
      }

      if (!mouseDownRef) {
        positionEditorElement(editorElem, rect);
      }
      setLastSelection(selection as RangeSelection);
    } else if (!activeElement || activeElement.className !== "link-input") {
      positionEditorElement(editorElem, null);
      setLastSelection(null);
      setEditMode(false);
      setLinkUrl("");
    }

    return true;
  };

  createEffect(() => {
    updateLinkEditor();
    onCleanup(mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateLinkEditor();
        });
      }),

      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateLinkEditor();
          return true;
        },
        LowPriority
      )
    ));
  });

  createEffect(() => {
    if (isEditMode() && inputRef) {
      inputRef.focus();
    }
  });

  return (
    <div ref={editorRef} class="link-editor">
      {isEditMode() ? (
        <input
          ref={inputRef}
          class="link-input"
          value={linkUrl()}
          onChange={(event) => {
            setLinkUrl(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (lastSelection !== null) {
                if (linkUrl() !== "") {
                  editor.dispatchCommand(TOGGLE_LINK_COMMAND, linkUrl);
                }
                setEditMode(false);
              }
            } else if (event.key === "Escape") {
              event.preventDefault();
              setEditMode(false);
            }
          }}
        />
      ) : (
        <>
          <div class="link-input">
            <a href={linkUrl()} target="_blank" rel="noopener noreferrer">
              {linkUrl()}
            </a>
            <div
              class="link-edit"
              role="button"
              tabIndex={0}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setEditMode(true);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function Select(props: {
  onChange: JSX.EventHandlerUnion<HTMLSelectElement, Event>;
  class: string;
  options: any;
  value: string;
}) {
  return (
    <select
      class={props.class}
      onChange={props.onChange}
      value={props.value}
    >
      <option hidden={true} value="" />
      <For each={props.options}>
        {(option) => (
          //@ts-ignore
          <option value={option}>{option}</option>
        )}
      </For>
    </select>
  );
}

function getSelectedNode(selection) {
  const anchor = selection.anchor;
  const focus = selection.focus;
  const anchorNode = selection.anchor.getNode();
  const focusNode = selection.focus.getNode();
  if (anchorNode === focusNode) {
    return anchorNode;
  }
  const isBackward = selection.isBackward();
  if (isBackward) {
    return $isAtNodeEnd(focus) ? anchorNode : focusNode;
  } else {
    return $isAtNodeEnd(anchor) ? focusNode : anchorNode;
  }
}

function BlockOptionsDropdownList(props: {
  editor: LexicalEditor;
  blockType: string;
  toolbarRef: HTMLDivElement;
  setShowBlockOptionsDropDown: (val: boolean) => any;
}) {
  let dropDownRef!: HTMLDivElement;

  createEffect(() => {
    const toolbar = props.toolbarRef;
    const dropDown = dropDownRef;

    if (toolbar !== null && dropDown !== null) {
      const { top, left } = toolbar.getBoundingClientRect();
      dropDown.style.top = `${top + 40}px`;
      dropDown.style.left = `${left}px`;
    }
  });

  createEffect(() => {
    const dropDown = dropDownRef;
    const toolbar = props.toolbarRef;

    if (dropDown !== null && toolbar !== null) {
      const handle = (event) => {
        const target = event.target;

        if (!dropDown.contains(target) && !toolbar.contains(target)) {
          props.setShowBlockOptionsDropDown(false);
        }
      };
      document.addEventListener("click", handle);

      onCleanup(() => {
        document.removeEventListener("click", handle);
      });
    }
  });

  const formatParagraph = () => {
    if (props.blockType !== "paragraph") {
      props.editor.update(() => {
        const selection = $getSelection();

        if ($isRangeSelection(selection)) {
          $wrapLeafNodesInElements(selection as RangeSelection, () =>
            $createParagraphNode()
          );
        }
      });
    }
    props.setShowBlockOptionsDropDown(false);
  };

  const formatLargeHeading = () => {
    if (props.blockType !== "h1") {
      props.editor.update(() => {
        const selection = $getSelection();

        if ($isRangeSelection(selection)) {
          $wrapLeafNodesInElements(
            selection as RangeSelection,
            () => $createHeadingNode("h1") as any
          );
        }
      });
    }
    props.setShowBlockOptionsDropDown(false);
  };

  const formatSmallHeading = () => {
    if (props.blockType !== "h2") {
      props.editor.update(() => {
        const selection = $getSelection();

        if ($isRangeSelection(selection)) {
          $wrapLeafNodesInElements(
            selection as RangeSelection,
            () => $createHeadingNode("h2") as any
          );
        }
      });
    }
    props.setShowBlockOptionsDropDown(false);
  };

  const formatBulletList = () => {
    if (props.blockType !== "ul") {
      props.editor.dispatchCommand(
        INSERT_UNORDERED_LIST_COMMAND,
        undefined
      );
    } else {
      props.editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    }
    props.setShowBlockOptionsDropDown(false);
  };

  const formatNumberedList = () => {
    if (props.blockType !== "ol") {
      props.editor.dispatchCommand(
        INSERT_ORDERED_LIST_COMMAND,
        undefined
      );
    } else {
      props.editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    }
    props.setShowBlockOptionsDropDown(false);
  };

  const formatQuote = () => {
    if (props.blockType !== "quote") {
      props.editor.update(() => {
        const selection = $getSelection();

        if ($isRangeSelection(selection)) {
          $wrapLeafNodesInElements(
            selection as RangeSelection,
            () => $createQuoteNode() as unknown as ElementNode
          );
        }
      });
    }
    props.setShowBlockOptionsDropDown(false);
  };

  const formatCode = () => {
    if (props.blockType !== "code") {
      props.editor.update(() => {
        const selection = $getSelection();

        if ($isRangeSelection(selection)) {
          $wrapLeafNodesInElements(selection as RangeSelection, () =>
            $createCodeNode()
          );
        }
      });
    }
    props.setShowBlockOptionsDropDown(false);
  };

  return (
    <div class="dropdown" ref={dropDownRef}>
      <button class="item" onClick={formatParagraph}>
        <span class="icon paragraph" />
        <span class="text">Normal</span>
        {props.blockType === "paragraph" && <span class="active" />}
      </button>
      <button class="item" onClick={formatLargeHeading}>
        <span class="icon large-heading" />
        <span class="text">Large Heading</span>
        {props.blockType === "h1" && <span class="active" />}
      </button>
      <button class="item" onClick={formatSmallHeading}>
        <span class="icon small-heading" />
        <span class="text">Small Heading</span>
        {props.blockType === "h2" && <span class="active" />}
      </button>
      <button class="item" onClick={formatBulletList}>
        <span class="icon bullet-list" />
        <span class="text">Bullet List</span>
        {props.blockType === "ul" && <span class="active" />}
      </button>
      <button class="item" onClick={formatNumberedList}>
        <span class="icon numbered-list" />
        <span class="text">Numbered List</span>
        {props.blockType === "ol" && <span class="active" />}
      </button>
      <button class="item" onClick={formatQuote}>
        <span class="icon quote" />
        <span class="text">Quote</span>
        {props.blockType === "quote" && <span class="active" />}
      </button>
      <button class="item" onClick={formatCode}>
        <span class="icon code" />
        <span class="text">Code Block</span>
        {props.blockType === "code" && <span class="active" />}
      </button>
    </div>
  );
}

export default function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  let [toolbarRef, setToolbarRef] = createSignal<HTMLDivElement | undefined>();
  const [canUndo, setCanUndo] = createSignal(false);
  const [canRedo, setCanRedo] = createSignal(false);
  const [blockType, setBlockType] = createSignal("paragraph");
  const [selectedElementKey, setSelectedElementKey] = createSignal(null);
  const [showBlockOptionsDropDown, setShowBlockOptionsDropDown] =
    createSignal(false);
  const [codeLanguage, setCodeLanguage] = createSignal("");
  const [isRTL, setIsRTL] = createSignal(false);
  const [isLink, setIsLink] = createSignal(false);
  const [isBold, setIsBold] = createSignal(false);
  const [isItalic, setIsItalic] = createSignal(false);
  const [isUnderline, setIsUnderline] = createSignal(false);
  const [isStrikethrough, setIsStrikethrough] = createSignal(false);
  const [isCode, setIsCode] = createSignal(false);

  const updateToolbar = () => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      //@ts-ignore
      const anchorNode: LexicalNode = selection.anchor.getNode();
      const element =
        anchorNode.getKey() === "root"
          ? anchorNode
          : anchorNode.getTopLevelElementOrThrow();
      const elementKey = element.getKey();
      const elementDOM = editor.getElementByKey(elementKey);
      if (elementDOM !== null) {
        setSelectedElementKey(elementKey);
        if ($isListNode(element)) {
          const parentList = $getNearestNodeOfType(anchorNode, ListNode);
          //@ts-ignore
          const type = parentList ? parentList.getTag() : element.getTag();
          setBlockType(type);
        } else {
          const type = $isHeadingNode(element)
            ? //@ts-ignore
            element.getTag()
            : element.getType();
          setBlockType(type);
          if ($isCodeNode(element)) {
            //@ts-ignore
            setCodeLanguage(element.getLanguage() || getDefaultCodeLanguage());
          }
        }
      }
      // Update text format
      setIsBold((selection as RangeSelection).hasFormat("bold"));
      setIsItalic((selection as RangeSelection).hasFormat("italic"));
      setIsUnderline((selection as RangeSelection).hasFormat("underline"));
      setIsStrikethrough(
        (selection as RangeSelection).hasFormat("strikethrough")
      );
      setIsCode((selection as RangeSelection).hasFormat("code"));
      setIsRTL($isParentElementRTL(selection as RangeSelection));

      // Update links
      const node = getSelectedNode(selection);
      const parent = node.getParent();
      if ($isLinkNode(parent) || $isLinkNode(node)) {
        setIsLink(true);
      } else {
        setIsLink(false);
      }
    }
  };

  onMount(() => {
    onCleanup(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar();
        });
      })
    );
  });

  onMount(() => {
    onCleanup(
      mergeRegister(
        editor.registerCommand(
          SELECTION_CHANGE_COMMAND,
          (_payload, newEditor) => {
            updateToolbar();
            return false;
          },
          LowPriority
        ),
        editor.registerCommand(
          CAN_UNDO_COMMAND,
          (payload: boolean) => {
            setCanUndo(payload);
            return false;
          },
          LowPriority
        ),
        editor.registerCommand(
          CAN_REDO_COMMAND,
          (payload: boolean) => {
            setCanRedo(payload);
            return false;
          },
          LowPriority
        )
      )
    );
  });

  const codeLanguges = createMemo(() => getCodeLanguages());
  const onCodeLanguageSelect = (e) => {
    editor.update(() => {
      if (selectedElementKey !== null) {
        const node = $getNodeByKey(selectedElementKey());
        if ($isCodeNode(node)) {
          (node as any).setLanguage(e.target.value);
        }
      }
    });
  };

  const insertLink = () => {
    if (!isLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, "https://");
    } else {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    }
  };

  return (
    <div class="toolbar" ref={setToolbarRef}>
      <button
        disabled={!canUndo()}
        onClick={() => {
          editor.dispatchCommand(UNDO_COMMAND, undefined);
        }}
        class="toolbar-item spaced"
        aria-label="Undo"
      >
        <i class="format undo" />
      </button>
      <button
        disabled={!canRedo()}
        onClick={() => {
          editor.dispatchCommand(REDO_COMMAND, undefined);
        }}
        class="toolbar-item"
        aria-label="Redo"
      >
        <i class="format redo" />
      </button>
      <Divider />
      {supportedBlockTypes.has(blockType()) && (
        <>
          <button
            class="toolbar-item block-controls"
            onClick={() =>
              setShowBlockOptionsDropDown(!showBlockOptionsDropDown())
            }
            aria-label="Formatting Options"
          >
            <span class={"icon block-type " + blockType()} />
            <span class="text">{blockTypeToBlockName[blockType()]}</span>
            <i class="chevron-down" />
          </button>
          {showBlockOptionsDropDown() && (
            <Portal>
              <BlockOptionsDropdownList
                editor={editor}
                blockType={blockType()}
                toolbarRef={toolbarRef()}
                setShowBlockOptionsDropDown={setShowBlockOptionsDropDown}
              />
            </Portal>
          )}
          <Divider />
        </>
      )}
      {blockType() === "code" ? (
        <>
          <Select
            class="toolbar-item code-language"
            onChange={onCodeLanguageSelect}
            options={codeLanguges()}
            value={codeLanguage()}
          />
          <i class="chevron-down inside" />
          <Divider />
        </>
      ) : null}
      <button
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
        }}
        class={"toolbar-item spaced " + (isBold() ? "active" : "")}
        aria-label="Format Bold"
      >
        <i class="format bold" />
      </button>
      <button
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
        }}
        class={"toolbar-item spaced " + (isItalic() ? "active" : "")}
        aria-label="Format Italics"
      >
        <i class="format italic" />
      </button>
      <button
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline");
        }}
        class={"toolbar-item spaced " + (isUnderline() ? "active" : "")}
        aria-label="Format Underline"
      >
        <i class="format underline" />
      </button>
      <button
        onClick={() => {
          editor.dispatchCommand(
            FORMAT_TEXT_COMMAND,
            "strikethrough"
          );
        }}
        class={"toolbar-item spaced " + (isStrikethrough() ? "active" : "")}
        aria-label="Format Strikethrough"
      >
        <i class="format strikethrough" />
      </button>
      <button
        onClick={() => {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code");
        }}
        class={"toolbar-item spaced " + (isCode() ? "active" : "")}
        aria-label="Insert Code"
      >
        <i class="format code" />
      </button>
      <button
        onClick={insertLink}
        class={"toolbar-item spaced " + (isLink() ? "active" : "")}
        aria-label="Insert Link"
      >
        <i class="format link" />
      </button>
      {isLink() && (
        <Portal>
          <FloatingLinkEditor editor={editor} />
        </Portal>
      )}
      <Divider />
      <button
        onClick={() => {
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "left");
        }}
        class="toolbar-item spaced"
        aria-label="Left Align"
      >
        <i class="format left-align" />
      </button>
      <button
        onClick={() => {
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "center");
        }}
        class="toolbar-item spaced"
        aria-label="Center Align"
      >
        <i class="format center-align" />
      </button>
      <button
        onClick={() => {
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "right");
        }}
        class="toolbar-item spaced"
        aria-label="Right Align"
      >
        <i class="format right-align" />
      </button>
      <button
        onClick={() => {
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "justify");
        }}
        class="toolbar-item"
        aria-label="Justify Align"
      >
        <i class="format justify-align" />
      </button>
    </div>
  );
}
