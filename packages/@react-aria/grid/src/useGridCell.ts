/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import {focusSafely, getFocusableTreeWalker} from '@react-aria/focus';
import {GridCollection} from '@react-types/grid';
import {GridState} from '@react-stately/grid';
import {HTMLAttributes, KeyboardEvent, RefObject} from 'react';
import {isFocusVisible, usePress} from '@react-aria/interactions';
import {mergeProps} from '@react-aria/utils';
import {Node as RSNode} from '@react-types/shared';
import {useLocale} from '@react-aria/i18n';
import {useSelectableItem} from '@react-aria/selection';

interface GridCellProps {
  node: RSNode<unknown>,
  ref: RefObject<HTMLElement>,
  isVirtualized?: boolean,
  isDisabled?: boolean,

  /* when a cell is focused, should the cell or it's first focusable item be focused */
  focusMode?: 'child' | 'cell'
}

interface GridCellAria {
  gridCellProps: HTMLAttributes<HTMLElement>
}

export function useGridCell<T, C extends GridCollection<T>>(props: GridCellProps, state: GridState<T, C>): GridCellAria {
  let {
    node,
    ref,
    isVirtualized,
    isDisabled,
    focusMode = 'child'
  } = props;

  let {direction} = useLocale();

  // Handles focusing the cell. If there is a focusable child,
  // it is focused, otherwise the cell itself is focused.
  let focus = () => {
    let treeWalker = getFocusableTreeWalker(ref.current);
    let focusable = ref.current.compareDocumentPosition(document.activeElement) & Node.DOCUMENT_POSITION_FOLLOWING
      ? treeWalker.lastChild() as HTMLElement
      : treeWalker.firstChild() as HTMLElement;
    if (focusable && focusMode === 'child') {
      focusSafely(focusable);
    } else {
      focusSafely(ref.current);
    }
  };

  let {itemProps} = useSelectableItem({
    selectionManager: state.selectionManager,
    key: node.key,
    ref,
    isVirtualized,
    focus
  });

  // TODO: move into useSelectableItem?
  let {pressProps} = usePress({...itemProps, isDisabled});

  let onKeyDown = (e: KeyboardEvent) => {
    let focusable;
    // TODO: need to fix walker + active element
    let walker = getFocusableTreeWalker(ref.current);
    let leftNode = direction === 'rtl' ? walker.nextNode : walker.previousNode;
    let rightNode = direction === 'rtl' ? walker.previousNode : walker.nextNode;
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        e.stopPropagation();
        focusable = leftNode();
        if (focusable) { // todo remove check once rows are not focusable
          focusable.focus();
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        e.stopPropagation();
        focusable = rightNode();
        if (focusable && focusable !== ref.current) {
          focusable.focus();
        }
        break;
    }
  };

  // Grid cells can have focusable elements inside them. In this case, focus should
  // be marshalled to that element rather than focusing the cell itself.
  let onFocus = (e) => {
    if (e.target !== ref.current) {
      // useSelectableItem only handles setting the focused key when
      // the focused element is the gridcell itself. We also want to
      // set the focused key when a child element receives focus.
      // If focus is currently visible (e.g. the user is navigating with the keyboard),
      // then skip this. We want to restore focus to the previously focused row/cell
      // in that case since the table should act like a single tab stop.
      if (!isFocusVisible()) {
        state.selectionManager.setFocusedKey(node.key);
      }
      return;
    }

    // If the cell itself is focused, wait a frame so that focus finishes propagatating
    // up to the tree, and move focus to a focusable child if possible.
    requestAnimationFrame(() => {
      if (focusMode === 'child' && document.activeElement === ref.current) {
        focus();
      }
    });
  };

  let gridCellProps: HTMLAttributes<HTMLElement> = mergeProps(pressProps, {
    role: 'gridcell',
    onKeyDownCapture: onKeyDown,
    onFocus
  });

  if (isVirtualized) {
    gridCellProps['aria-colindex'] = node.index + 1; // aria-colindex is 1-based
  }

  return {
    gridCellProps
  };
}
