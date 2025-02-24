/* Tab Manager - Drag Start Handler */

import { collectionsData, selectedCollectionIndex } from './script.js'; // Import from script.js

export let dragState = { // Exported to be shared with script.js
  type: null, // 'collection', 'window-group', 'tab-card', or null
  element: null, // The DOM element being dragged
  groupId: -1, // Index of the group (for collections and middle panel tabs)
  pos: -1, // Renamed from colIdx: Position of the collection within the group
  windowId: null, // Window ID (for window groups)
  tabData: null // Tab object (for tab cards)
};

export let scrollPosition = 0; // Exported to maintain scroll state consistency

export function dragStart(e) {
  // Reset drag state to ensure clean slate
  dragState = {
    type: null,
    element: null,
    groupId: -1,
    pos: -1, // Renamed from colIdx
    windowId: null,
    tabData: null
  };

  const collectionDiv = e.target.classList.contains('collection') ? e.target : e.target.closest('.collection');
  const tabCard = e.target.classList.contains('tab-card') ? e.target : e.target.closest('.tab-card'); // Check tabCard first
  const windowGroup = e.target.classList.contains('window-group') ? e.target : e.target.closest('.window-group');

  if (collectionDiv && collectionDiv.draggable) {
    // Branch: Dragging a collection card from the left panel
    // Records: Collection DOM element and its group/collection indices
    dragState.type = 'collection';
    dragState.element = collectionDiv;
    const indexParts = collectionDiv.dataset.index.split('-');
    dragState.groupId = parseInt(indexParts[0]);
    dragState.pos = parseInt(indexParts[1]); // Renamed from colIdx
    e.dataTransfer.setData('source', 'collections-panel');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.dropEffect = 'move';
    setTimeout(() => collectionDiv.classList.add('dragging'), 0);
    console.log('Dragging collection:', { groupId: dragState.groupId, pos: dragState.pos }); // Updated log
  } else if (tabCard && tabCard.closest('#tabs-panel')) {
    // Branch: Dragging a single tab card from the right panel
    // Records: Tab card DOM element and its full tab data (fetched from Chrome)
    dragState.type = 'tab-card';
    dragState.element = tabCard;
    const tabId = parseInt(tabCard.dataset.tabId);
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        console.error('Error fetching tab during dragstart:', chrome.runtime.lastError);
        dragState.tabData = null;
      } else {
        dragState.tabData = {
          id: tab.id,
          title: tab.title,
          url: tab.url,
          favIconUrl: tab.favIconUrl || '',
          windowId: tab.windowId, // Include windowId for drop handling
          index: tab.index // Include index for reordering
        };
      }
    });
    e.dataTransfer.setData('source', 'tabs-panel-tab');
    e.dataTransfer.setData('tab-id', tabId.toString()); // Fallback, though we'll rely on dragState.tabData
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.dropEffect = 'move';
    setTimeout(() => tabCard.classList.add('dragging'), 0);
    console.log('Dragging tab card from tabs panel:', { tabId: tabId });
  } else if (tabCard && tabCard.closest('#collection-content-panel')) {
    // Branch: Dragging a tab card from the middle panel (collection content)
    // Records: Tab card DOM element, its tab data, and source collection indices from selectedCollectionIndex
    dragState.type = 'tab-card';
    dragState.element = tabCard;
    const tabIndex = parseInt(tabCard.dataset.index);

    if (selectedCollectionIndex === null) {
      console.error('No collection selected for dragstart in middle panel');
      return;
    }

    let groupId = -1;
    let pos = -1; // Renamed from colIdx
    for (let gIdx = 0; gIdx < collectionsData.length; gIdx++) {
      const foundCol = collectionsData[gIdx].collections.find(c => c.collectionId === selectedCollectionIndex);
      if (foundCol) {
        groupId = gIdx;
        pos = collectionsData[gIdx].collections.indexOf(foundCol); // Renamed from colIdx
        break;
      }
    }

    if (groupId === -1 || pos === -1) { // Updated variable name
      console.error('Could not find groupId or pos for selectedCollectionIndex:', selectedCollectionIndex); // Updated log
      return;
    }

    dragState.groupId = groupId;
    dragState.pos = pos; // Renamed from colIdx
    const collection = collectionsData[groupId].collections[pos]; // Updated variable name
    dragState.tabData = collection.tabs[tabIndex];
    e.dataTransfer.setData('source', 'collection-content-tab');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.dropEffect = 'move';
    setTimeout(() => tabCard.classList.add('dragging'), 0);
    console.log('Dragging tab card from collection content:', { groupId, pos, tabIndex }); // Updated log
  } else if (windowGroup) {
    // Branch: Dragging a window group from the right panel
    // Records: Window group DOM element and its window ID
    dragState.type = 'window-group';
    dragState.element = windowGroup;
    dragState.windowId = parseInt(windowGroup.dataset.windowId);
    scrollPosition = document.getElementById('tabs-panel').scrollTop; // Access tabsPanel directly
    e.dataTransfer.setData('text/plain', `window:${dragState.windowId}`);
    e.dataTransfer.setData('source', 'tabs-panel');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.dropEffect = 'move';
    setTimeout(() => windowGroup.classList.add('dragging'), 0);
    console.log('Dragging window group:', { windowId: dragState.windowId });
  } else {
    // Branch: No draggable element detected (e.g., clicking a non-draggable part)
    // Records: Nothing, dragState remains reset
    console.log('No draggable element detected');
    return;
  }
}
