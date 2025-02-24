import { dragStart, dragState, scrollPosition } from './dragStart.js';

// Export state variables for dragStart.js
export let collectionsData = JSON.parse(localStorage.getItem('collectionsData')) || []; // Array of groups with collections
export let selectedCollectionIndex = null; // Index of currently selected collection (numeric index, now collectionId)

document.addEventListener('DOMContentLoaded', () => {
  // --- Constants and State ---
  // Main DOM elements
  const collectionsPanel = document.getElementById('collections-panel'); // Left panel
  const collectionContentPanel = document.getElementById('collection-content-panel'); // Middle panel
  const tabsPanel = document.getElementById('tabs-panel'); // Right panel
  const dividerLeft = document.getElementById('divider-left'); // Left divider
  const dividerRight = document.getElementById('divider-right'); // Right divider
  const collectionsList = document.getElementById('collections-list'); // Container for collections
  const collectionContent = document.getElementById('collection-content'); // Container for selected collection tabs
  const tabsContent = document.getElementById('tabs-content'); // Container for all tabs
  const openAllTabsButton = document.getElementById('open-all-tabs'); // Button to open all tabs in selected collection
  const openAllNewWindowButton = document.getElementById('open-all-new-window'); // Button to open all tabs in new window
  const exportCollectionsButton = document.getElementById('export-collections'); // Export button
  const importCollectionsButton = document.getElementById('import-collections-btn'); // Import button
  const importCollectionsFile = document.getElementById('import-collections-file'); // Hidden file input

  // State for tab monitoring
  let previousTabs = []; // Store the previous state of browser tabs for comparison

  // Color palette for domain-based backgrounds
  const colors = [
    '#E6E6FA', '#F0FFF0', '#F5F5DC', '#F0F8FF', '#F5FFFA',
    '#FFF5EE', '#F0FFFF', '#FFFAF0', '#F8F1E9', '#E0FFFF'
  ];

  // --- Utility Functions ---
  // Generate background color based on domain name
  function getColorForDomain(domain) {
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
      hash = domain.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  // Extract domain from URL
  function getDomain(url) {
    try {
      return new URL(url).hostname.split('.').slice(-2).join('.');
    } catch (e) {
      return url;
    }
  }

  // Find the element to insert after during drag-and-drop (for collections)
  function getDragAfterElement(container, x, y, selector = '.collection:not(.dragging)') {
    const draggableElements = [...container.querySelectorAll(selector)];
    if (draggableElements.length === 0) return null;

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top;
      if (offset > 0 && (offset < (box.height / 2) || offset < closest.offset)) {
        return { offset: offset, element: child };
      }
      return closest;
    }, { offset: Number.POSITIVE_INFINITY, element: null }).element;
  }

  // Determine drop position for tab cards within a live group (row-based)
  function getDropPositionInWindowGroup(container, x, y) {
    const tabCards = [...container.querySelectorAll('.tab-card:not(.dragging)')];
    if (tabCards.length === 0) return 0; // Append to empty group

    const containerRect = container.getBoundingClientRect();
    const cardWidth = 180 + 10; // Width (180px) + gap (10px)
    const cardHeight = 100 + 10; // Height (100px) + gap (10px)
    const row = Math.floor((y - containerRect.top) / cardHeight);
    const col = Math.floor((x - containerRect.left) / cardWidth);
    const cardsPerRow = Math.floor(containerRect.width / cardWidth);

    let dropIndex = row * cardsPerRow + col;
    dropIndex = Math.max(0, Math.min(dropIndex, tabCards.length)); // Clamp between 0 and length
    return dropIndex;
  }

  // Save collections data to local storage
  function saveCollections() {
    localStorage.setItem('collectionsData', JSON.stringify(collectionsData));
  }

  // Export collections to JSON file
  function exportCollections() {
    const json = JSON.stringify(collectionsData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'collections.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('Collections exported to collections.json');
  }

  // Import collections from JSON file
  function importCollections(event) {
    const file = event.target.files[0];
    if (!file) return;

    const proceed = confirm('Proceed with importing collections from ' + file.name + '?');
    if (!proceed) {
      console.log('Import cancelled by user');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (!Array.isArray(importedData)) {
          throw new Error('Invalid JSON format: must be an array');
        }

        const replace = confirm('Do you want to replace existing collections? Click "OK" to replace, "Cancel" to append.');
        if (replace) {
          const confirmReplace = confirm('Are you sure you want to replace all existing collections? This action cannot be undone.');
          if (confirmReplace) {
            collectionsData = importedData;
            console.log('Collections replaced with imported data');
          } else {
            console.log('Replace action cancelled by user');
            return;
          }
        } else {
          const confirmAppend = confirm('Append imported collections to existing ones?');
          if (confirmAppend) {
            collectionsData = [...collectionsData, ...importedData];
            console.log('Imported collections appended to existing data');
          } else {
            console.log('Append action cancelled by user');
            return;
          }
        }

        saveCollections();
        renderCollections();
        renderCollectionContent();
      } catch (error) {
        console.error('Error importing collections:', error.message);
        alert('Failed to import collections: ' + error.message);
      }
    };
    reader.readAsText(file);
  }

  // Open all tabs in the selected collection in the current window
  function openAllTabs() {
    if (selectedCollectionIndex === null) {
      console.error('No collection selected to open tabs');
      return;
    }

    let selectedCollection = null;
    collectionsData.forEach(group => {
      const col = group.collections.find(c => c.collectionId === selectedCollectionIndex);
      if (col) selectedCollection = col;
    });

    if (!selectedCollection || selectedCollection.tabs.length === 0) {
      console.error('No tabs to open in selected collection');
      return;
    }

    chrome.windows.getCurrent({}, (currentWindow) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting current window:', chrome.runtime.lastError);
        return;
      }

      selectedCollection.tabs.forEach(tab => {
        chrome.tabs.create({
          windowId: currentWindow.id,
          url: tab.url
        }, (newTab) => {
          if (chrome.runtime.lastError) {
            console.error('Error opening tab:', chrome.runtime.lastError);
          } else {
            console.log(`Opened tab in current window: ${tab.url}`);
          }
        });
      });
    });
  }

  // Open all tabs in the selected collection in a new window
  function openAllInNewWindow() {
    if (selectedCollectionIndex === null) {
      console.error('No collection selected to open in new window');
      return;
    }

    let selectedCollection = null;
    collectionsData.forEach(group => {
      const col = group.collections.find(c => c.collectionId === selectedCollectionIndex);
      if (col) selectedCollection = col;
    });

    if (!selectedCollection || selectedCollection.tabs.length === 0) {
      console.error('No tabs to open in new window from selected collection');
      return;
    }

    const urls = selectedCollection.tabs.map(tab => tab.url);
    chrome.windows.create({ url: urls }, (newWindow) => {
      if (chrome.runtime.lastError) {
        console.error('Error creating new window:', chrome.runtime.lastError);
      } else {
        console.log(`Opened ${urls.length} tabs in new window (ID: ${newWindow.id})`);
      }
    });
  }

  // --- Tab Management Functions ---
  // Check and close empty windows
  function checkAndCloseEmptyWindow(windowId) {
    chrome.tabs.query({ windowId: windowId }, (tabs) => {
      if (tabs.length === 0) {
        chrome.windows.remove(windowId);
      }
    });
  }

  // Load and render all tabs in the right panel (live groups and live cards)
  function loadAllTabs() {
    const currentScroll = tabsPanel.scrollTop;
    tabsContent.innerHTML = '';
    chrome.tabs.query({}, (tabs) => {
      const tabsByWindow = {};
      tabs.forEach(tab => {
        if (!tabsByWindow[tab.windowId]) {
          tabsByWindow[tab.windowId] = [];
        }
        tabsByWindow[tab.windowId].push(tab);
      });

      Object.keys(tabsByWindow).forEach((windowId, idx) => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'window-group';
        groupDiv.draggable = true;
        groupDiv.dataset.windowId = windowId;
        groupDiv.innerHTML = `
          <h3>Window ${idx + 1} (ID: ${windowId})</h3>
          <button class="hibernate-btn">H</button>
          <button class="sort-tabs-btn">S</button>
          <button class="close-window-btn">X</button>
          <div class="tab-card-container"></div>
        `;
        const cardContainer = groupDiv.querySelector('.tab-card-container');

        groupDiv.addEventListener('dragstart', dragStart);
        groupDiv.addEventListener('dragend', () => cleanupDrag(groupDiv));
        groupDiv.addEventListener('dragover', dragOverTab);
        groupDiv.addEventListener('dragleave', dragLeaveTab);
        groupDiv.addEventListener('drop', drop);
        groupDiv.addEventListener('dragenter', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          groupDiv.classList.add('drag-over');
        });

        // Close window button
        groupDiv.querySelector('.close-window-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          chrome.windows.remove(parseInt(windowId), () => {
            if (chrome.runtime.lastError) {
              console.error('Error closing window:', chrome.runtime.lastError);
            } else {
              console.log(`Window ${windowId} closed successfully`);
              groupDiv.remove();
            }
          });
        });

        // Sort tabs button
        groupDiv.querySelector('.sort-tabs-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          const windowTabs = tabsByWindow[windowId];
          windowTabs.sort((a, b) => {
            const domainA = getDomain(a.url);
            const domainB = getDomain(b.url);
            if (domainA === domainB) {
              return a.index - b.index;
            }
            return domainA.localeCompare(domainB);
          });

          const tabIds = windowTabs.map(tab => tab.id);
          tabIds.forEach((tabId, newIndex) => {
            chrome.tabs.move(tabId, { windowId: parseInt(windowId), index: newIndex }, () => {
              if (chrome.runtime.lastError) {
                console.error('Error moving tab:', chrome.runtime.lastError);
              }
            });
          });
          loadAllTabs();
          tabsPanel.scrollTop = currentScroll;
        });

        // Hibernate button
        groupDiv.querySelector('.hibernate-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          const windowTabs = tabsByWindow[windowId];
          let hibernateGroup = collectionsData.find(group => group.name === 'Wake me UP!');
          if (!hibernateGroup) {
            hibernateGroup = { name: 'Wake me UP!', collections: [] };
            collectionsData.push(hibernateGroup);
          }

          let hibernateCollection = hibernateGroup.collections.find(col => col.name === `Window ${idx + 1} (ID: ${windowId})`);
          if (!hibernateCollection) {
            const newCollectionId = Math.max(...collectionsData.flatMap(g => g.collections.map(c => c.collectionId)), -1) + 1;
            hibernateCollection = { name: `Window ${idx + 1} (ID: ${windowId})`, tabs: [], collectionId: newCollectionId, groupId: collectionsData.indexOf(hibernateGroup), pos: hibernateGroup.collections.length };
            hibernateGroup.collections.push(hibernateCollection);
          }

          windowTabs.forEach(tab => {
            hibernateCollection.tabs.push({
              title: tab.title,
              url: tab.url,
              favIconUrl: tab.favIconUrl || '' // Discard id and windowId
            });
          });

          saveCollections();
          renderCollections();
          if (selectedCollectionIndex === hibernateCollection.collectionId) renderCollectionContent();

          chrome.windows.remove(parseInt(windowId), () => {
            if (chrome.runtime.lastError) {
              console.error('Error closing window during hibernate:', chrome.runtime.lastError);
            } else {
              console.log(`Window ${windowId} hibernated and closed`);
              groupDiv.remove();
            }
          });
        });

        // Add live cards to live group
        tabsByWindow[windowId].forEach(tab => {
          const card = createTabCard(tab);
          cardContainer.appendChild(card);
        });

        tabsContent.appendChild(groupDiv);
      });
      tabsPanel.scrollTop = currentScroll;
      // Update previousTabs after initial render or refresh
      previousTabs = tabs.map(tab => ({ id: tab.id, windowId: tab.windowId }));
    });
  }

  // --- UI Rendering Functions ---
  // Create a tab card for the right panel (live cards) - tabId hidden from UI
  function createTabCard(tab) {
    const card = document.createElement('div');
    card.className = 'tab-card';
    card.dataset.tabId = tab.id.toString(); // Keep tabId in dataset for functionality, not displayed
    card.draggable = true; // Make tab card draggable
    const isPdf = tab.url.toLowerCase().endsWith('.pdf');
    const hasFavicon = tab.favIconUrl && !isPdf;
    const domain = getDomain(tab.url);
    const bgColor = getColorForDomain(domain);
    card.style.backgroundColor = bgColor;

    const iconClass = isPdf ? 'pdf-icon' : (hasFavicon ? 'favicon-icon' : 'empty-icon');
    const faviconStyle = hasFavicon ? `style="--favicon-url: url('${tab.favIconUrl}');"` : '';

    card.innerHTML = `
      <span class="card-icon ${iconClass}" ${faviconStyle}></span>
      <div class="title-section">${tab.title}</div>
      <div class="url-section">${tab.url}</div>
      <button class="close-btn">X</button>
    `;
    // Drag-and-drop listeners for tab card
    card.addEventListener('dragstart', dragStart);
    card.addEventListener('dragend', () => cleanupDrag(card));

    // Click to switch to tab
    card.addEventListener('click', (e) => {
      if (e.target.className !== 'close-btn') {
        chrome.tabs.update(tab.id, { active: true }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error switching to tab:', chrome.runtime.lastError);
          } else {
            chrome.windows.update(tab.windowId, { focused: true });
          }
        });
      }
    });
    // Close tab button
    card.querySelector('.close-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.tabs.remove(tab.id, () => {
        if (chrome.runtime.lastError) {
          console.error('Error closing tab:', chrome.runtime.lastError);
        } else {
          console.log('Tab', tab.id, 'closed successfully');
          card.remove();
          checkAndCloseEmptyWindow(tab.windowId);
          loadAllTabs();
        }
      });
    });
    return card;
  }

  // Create a tab card for the middle panel (stored cards, styled like right panel, without ID)
  function createCollectionTabCard(tab, collectionIndex, tabIndex) {
    const card = document.createElement('div');
    card.className = 'tab-card';
    card.dataset.index = tabIndex; // Keep index for drag-and-drop, no tabId needed
    card.draggable = true; // Make tab card draggable
    const isPdf = tab.url.toLowerCase().endsWith('.pdf');
    const hasFavicon = tab.favIconUrl && !isPdf;
    const domain = getDomain(tab.url);
    const bgColor = getColorForDomain(domain);
    card.style.backgroundColor = bgColor;

    const iconClass = isPdf ? 'pdf-icon' : (hasFavicon ? 'favicon-icon' : 'empty-icon');
    const faviconStyle = hasFavicon ? `style="--favicon-url: url('${tab.favIconUrl}');"` : '';

    card.innerHTML = `
      <span class="card-icon ${iconClass}" ${faviconStyle}></span>
      <div class="title-section">${tab.title}</div>
      <div class="url-section">${tab.url}</div>
      <button class="close-btn">X</button>
    `;
    // Drag-and-drop listeners for tab card
    card.addEventListener('dragstart', dragStart);
    card.addEventListener('dragend', () => cleanupDrag(card));

    // Click to open tab in new window
    card.addEventListener('click', (e) => {
      if (e.target.className !== 'close-btn') {
        chrome.tabs.create({ url: tab.url });
      }
    });
    // Remove tab from collection
    card.querySelector('.close-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const [groupId, pos] = collectionIndex.split('-').map(Number);
      collectionsData[groupId].collections[pos].tabs.splice(tabIndex, 1);
      saveCollections();
      renderCollections();
      renderCollectionContent();
    });
    return card;
  }

  // Create a collection div for rendering
  function createCollectionDiv(col, index) {
    const colDiv = document.createElement('div');
    colDiv.className = `collection ${selectedCollectionIndex === col.collectionId ? 'selected' : ''}`;
    colDiv.dataset.index = index; // DOM index remains as-is for drag purposes
    colDiv.draggable = true;
    colDiv.innerHTML = `
      <h3>${col.name} <span class="tab-count">(${col.tabs.length})</span><button class="rename-btn">R</button></h3>
      <button class="delete-btn">X</button>
    `;
    // Drag-and-drop listeners for collection
    colDiv.addEventListener('dragstart', dragStart);
    colDiv.addEventListener('dragend', () => cleanupDrag(colDiv));
    colDiv.addEventListener('dragover', dragOverCollection);
    colDiv.addEventListener('drop', drop);
    colDiv.addEventListener('dragleave', dragLeaveCollection);
    colDiv.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      colDiv.classList.add('over');
    });
    // Select collection on click
    colDiv.addEventListener('click', (e) => {
      if (!e.target.classList.contains('rename-btn') && !e.target.classList.contains('delete-btn')) {
        selectCollection(col.collectionId);
      }
    });
    // Rename collection
    colDiv.querySelector('.rename-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const newName = prompt('New name:', col.name);
      if (newName) {
        col.name = newName;
        saveCollections();
        renderCollections();
        if (selectedCollectionIndex === col.collectionId) renderCollectionContent();
      }
    });
    // Delete collection
    colDiv.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Delete ${col.name}?`)) {
        const [groupId] = index.split('-').map(Number);
        collectionsData[groupId].collections = collectionsData[groupId].collections.filter(c => c.collectionId !== col.collectionId);
        saveCollections();
        renderCollections();
        if (selectedCollectionIndex === col.collectionId) {
          selectedCollectionIndex = null;
          renderCollectionContent();
        }
      }
    });
    return colDiv;
  }

  // Render collections in the left panel
  function renderCollections() {
    collectionsList.innerHTML = ''; // Clear existing content

    // Render each group with its own Add Collection, Rename, Up, Down, and Delete buttons
    collectionsData.forEach((group, groupId) => {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'collection-group';
      groupDiv.dataset.groupId = groupId;
      groupDiv.innerHTML = `
        <h4>${group.name}</h4>
        <button class="delete-group-btn">X</button>
        <button class="rename-group-btn">R</button>
        <button class="up-group-btn">↑</button>
        <button class="down-group-btn">↓</button>
        <div class="collection-list"></div>
        <button class="add-collection-btn">+</button>
      `;
      const collectionList = groupDiv.querySelector('.collection-list');
      group.collections.forEach((col, pos) => {
        col.groupId = groupId;
        col.pos = pos;
        const colDiv = createCollectionDiv(col, `${groupId}-${pos}`);
        collectionList.appendChild(colDiv);
      });
      // Drag-and-drop listeners for group
      groupDiv.addEventListener('dragover', (e) => dragOverCollection(e, groupId));
      groupDiv.addEventListener('dragleave', dragLeaveCollection);
      groupDiv.addEventListener('drop', (e) => drop(e, groupId));
      groupDiv.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragState.type === 'collection') groupDiv.classList.add('drag-over');
      });

      // Add Collection button for this group
      const addCollectionBtn = groupDiv.querySelector('.add-collection-btn');
      addCollectionBtn.addEventListener('click', () => {
        const name = prompt('Enter collection name:', `Collection ${collectionsData.reduce((sum, g) => sum + g.collections.length, 0) + 1}`);
        if (name) {
          const newCollectionId = Math.max(...collectionsData.flatMap(g => g.collections.map(c => c.collectionId)), -1) + 1;
          collectionsData[groupId].collections.push({ name, tabs: [], collectionId: newCollectionId, groupId: groupId, pos: collectionsData[groupId].collections.length });
          saveCollections();
          renderCollections();
        }
      });

      // Rename group button
      const renameGroupBtn = groupDiv.querySelector('.rename-group-btn');
      renameGroupBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const newName = prompt('Enter new group name:', group.name);
        if (newName) {
          group.name = newName;
          saveCollections();
          renderCollections();
        }
      });

      // Up group button
      const upGroupBtn = groupDiv.querySelector('.up-group-btn');
      upGroupBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (groupId > 0) { // Not already at the top
          // Swap with the group above
          [collectionsData[groupId], collectionsData[groupId - 1]] = [collectionsData[groupId - 1], collectionsData[groupId]];
          saveCollections();
          renderCollections();
        }
      });

      // Down group button
      const downGroupBtn = groupDiv.querySelector('.down-group-btn');
      downGroupBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (groupId < collectionsData.length - 1) { // Not already at the bottom
          // Swap with the group below
          [collectionsData[groupId], collectionsData[groupId + 1]] = [collectionsData[groupId + 1], collectionsData[groupId]];
          saveCollections();
          renderCollections();
        }
      });

      // Delete group button
      const deleteBtn = groupDiv.querySelector('.delete-group-btn');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (collectionsData.length <= 1) {
          alert('Cannot delete the last group. At least one group must exist.');
          return;
        }
        if (confirm(`Delete group "${group.name}" and all its collections?`)) {
          const isSelectedInGroup = group.collections.some(col => col.collectionId === selectedCollectionIndex);
          collectionsData.splice(groupId, 1);
          if (isSelectedInGroup) selectedCollectionIndex = null;
          saveCollections();
          renderCollections();
          renderCollectionContent();
        }
      });

      collectionsList.appendChild(groupDiv);
    });

    // Add static Add Group button at the bottom
    collectionsList.appendChild(addGroupBtn);
    console.log('Add Group button rendered at bottom center of left panel'); // Debug log
  }

  // Render content of the selected collection in the middle panel
  function renderCollectionContent() {
    collectionContent.innerHTML = ''; // Clear existing content
    if (selectedCollectionIndex === null) {
      collectionContent.innerHTML = '<p>No collection selected.</p>';
      openAllTabsButton.style.display = 'none';
      openAllNewWindowButton.style.display = 'none';
    } else {
      let selectedCollection = null;
      collectionsData.forEach(group => {
        const col = group.collections.find(c => c.collectionId === selectedCollectionIndex);
        if (col) selectedCollection = col;
      });

      if (!selectedCollection || selectedCollection.tabs.length === 0) {
        collectionContent.innerHTML = '<p>No tabs in this collection yet.</p>';
        openAllTabsButton.style.display = 'none';
        openAllNewWindowButton.style.display = 'none';
      } else {
        const cardContainer = document.createElement('div');
        cardContainer.className = 'tab-card-container';
        selectedCollection.tabs.forEach((tab, tabIndex) => {
          const card = createCollectionTabCard(tab, `${selectedCollection.groupId}-${selectedCollection.pos}`, tabIndex);
          cardContainer.appendChild(card);
        });
        collectionContent.appendChild(cardContainer);
        openAllTabsButton.style.display = 'inline';
        openAllNewWindowButton.style.display = 'inline';
      }
    }
  }

  // --- Event Handling Functions ---
  // Divider drag handling
  let isDraggingDividerLeft = false;
  dividerLeft.addEventListener('mousedown', () => {
    isDraggingDividerLeft = true;
    dividerLeft.classList.add('dragging');
  });

  let isDraggingDividerRight = false;
  dividerRight.addEventListener('mousedown', () => {
    isDraggingDividerRight = true;
    dividerRight.classList.add('dragging');
  });

  document.addEventListener('mousemove', (e) => {
    if (isDraggingDividerLeft) {
      const containerWidth = document.getElementById('main-container').offsetWidth;
      let newWidth = Math.max(150, Math.min(e.clientX, containerWidth * 0.5));
      collectionsPanel.style.flex = `0 0 ${newWidth}px`;
    } else if (isDraggingDividerRight) {
      const containerWidth = document.getElementById('main-container').offsetWidth;
      let newWidth = Math.max(150, Math.min(containerWidth - e.clientX, containerWidth * 0.5));
      tabsPanel.style.flex = `0 0 ${newWidth}px`;
    }
  });

  document.addEventListener('mouseup', () => {
    if (isDraggingDividerLeft) {
      isDraggingDividerLeft = false;
      dividerLeft.classList.remove('dragging');
    }
    if (isDraggingDividerRight) {
      isDraggingDividerRight = false;
      dividerRight.classList.remove('dragging');
    }
  });

  // Cleanup after dragging
  function cleanupDrag(element) {
    if (!element) {
      console.error('cleanupDrag: Element is null');
      return;
    }
    console.log('Cleaning up drag:', { type: dragState.type, element: element.dataset.index || element.dataset.windowId || element.dataset.tabId });
    element.classList.remove('dragging');
    element.classList.add('dropped');
    setTimeout(() => element.classList.remove('dropped'), 500);
    // Reset drag state
    dragState.type = null;
    dragState.element = null;
    dragState.groupId = -1;
    dragState.pos = -1;
    dragState.windowId = null;
    dragState.tabData = null;
    tabsContent.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    collectionsList.querySelectorAll('.over').forEach(el => el.classList.remove('over'));
    collectionsList.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    collectionContentPanel.classList.remove('drag-over');
  }

  // Handle drag over for live groups
  function dragOverTab(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.target.closest('.window-group');
    if (!target || (dragState.type !== 'window-group' && dragState.type !== 'tab-card')) return;

    const liveGroup = target;
    liveGroup.classList.add('drag-over');
  }

  // Handle drag over for collections
  function dragOverCollection(e, groupId = -1) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const source = e.dataTransfer.getData('source');
    if (source !== 'collections-panel' && source !== 'tabs-panel-tab' && source !== 'collection-content-tab') return; // Allow collections or tab cards from any source

    const target = e.target.closest('.collection:not(.dragging)') || e.target.closest('.collection-group');
    if (!target) return;

    if (target.classList.contains('collection-group')) {
      const targetGroupId = parseInt(target.dataset.groupId);
      if (source === 'collections-panel' && targetGroupId !== dragState.groupId) {
        target.classList.add('drag-over');
      } // No drag-over for tab cards on groups
    } else if (target.classList.contains('collection')) {
      target.classList.add('over');
      if (source === 'collections-panel') {
        const container = target.closest('.collection-list');
        const afterElement = getDragAfterElement(container, e.clientX, e.clientY);
        if (afterElement && afterElement !== dragState.element) {
          container.insertBefore(dragState.element, afterElement);
        } else if (!afterElement && container.lastChild !== dragState.element) {
          container.appendChild(dragState.element);
        }
      } // For tab cards, just highlight; drop handles the addition
    }
  }

  // Handle drag leave for collections
  function dragLeaveCollection(e) {
    const target = e.target.closest('.collection') || e.target.closest('.collection-group');
    if (target) {
      target.classList.remove('over');
      target.classList.remove('drag-over');
    }
  }

  // Handle drag leave for live groups
  function dragLeaveTab(e) {
    const target = e.target.closest('.window-group');
    if (target) target.classList.remove('drag-over');
  }

  // Handle drop event
  function drop(e, targetGroupId = -1) {
    e.preventDefault(); // Prevent default browser behavior (e.g., opening URLs)
    e.stopPropagation(); // Stop event bubbling to parent elements

    // Identify the drop target: live group, collection, collection group, or middle panel
    const target = e.target.closest('.window-group') ||
        e.target.closest('.collection:not(.dragging)') ||
        e.target.closest('.collection-group') ||
        e.target.closest('#collection-content-panel');

    // Scenario 1: No valid drop target detected (e.g., dropped outside panels)
    // - Action: Log error and cleanup if something was dragged, then exit
    if (!target) {
      console.error('Drop failed: No valid target detected', { dragState });
      if (dragState.element) cleanupDrag(dragState.element); // Clean up dragging state
      return;
    }

    // Scenario 2: Nothing is being dragged (invalid drag state)
    // - Action: Log error and exit if dragState is incomplete
    if (!dragState.type || (!dragState.element && dragState.type !== 'window-group')) {
      console.error('Drop failed: No dragged element in dragState', { dragState, target });
      return;
    }

    // Scenario 3: Dragging a collection from the left panel onto another collection or group
    // - Condition: Target is a collection, group, or within collections-list
    // - Action: Reorder the collection within or across groups
    if (dragState.type === 'collection' && (target.classList.contains('collection') || target.classList.contains('collection-group') || target.closest('#collections-list'))) {
      const collection = collectionsData[dragState.groupId].collections[dragState.pos];
      collectionsData[dragState.groupId].collections.splice(dragState.pos, 1);

      let newGroupId = targetGroupId;
      if (newGroupId === -1) { // If not provided, determine from target
        const closestGroup = target.closest('.collection-group');
        newGroupId = closestGroup ? parseInt(closestGroup.dataset.groupId) : dragState.groupId;
      }

      // Determine where to insert within the target group’s collection list
      const targetContainer = target.classList.contains('collection-group')
          ? target.querySelector('.collection-list')
          : target.closest('.collection-list') || collectionsList.querySelector(`.collection-group[data-group-id="${newGroupId}"] .collection-list`);
      const afterElement = getDragAfterElement(targetContainer, e.clientX, e.clientY); // Find insertion point
      const newPos = afterElement
          ? collectionsData[newGroupId].collections.findIndex(c => c.collectionId === parseInt(afterElement.dataset.index.split('-')[1]))
          : collectionsData[newGroupId].collections.length; // Position after element or append

      if (afterElement && newPos !== -1) {
        collectionsData[newGroupId].collections.splice(newPos, 0, collection); // Insert before next collection
      } else {
        collectionsData[newGroupId].collections.push(collection); // Append to end
      }

      collection.groupId = newGroupId;
      collection.pos = newPos;

      saveCollections(); // Persist changes
      renderCollections(); // Refresh left panel
      if (selectedCollectionIndex === collection.collectionId) renderCollectionContent();
      cleanupDrag(dragState.element); // Reset drag state and UI
    }

        // Scenario 4: Dragging a live card from the right panel onto a collection
        // - Condition: Target is a collection, source is 'tabs-panel-tab'
    // - Action: Append the live card to the target collection, discarding id and windowId; if Shift is pressed, close the tab
    else if (dragState.type === 'tab-card' && target.classList.contains('collection') && e.dataTransfer.getData('source') === 'tabs-panel-tab') {
      console.log('Dropping live card from tabs panel onto existing collection', {
        tabId: dragState.tabData ? dragState.tabData.id : 'unknown',
        target: { groupId: targetGroupId, class: target.className },
        shiftKey: e.shiftKey
      });

      if (!dragState.tabData) {
        console.error('Dragged live card data not available');
        cleanupDrag(dragState.element);
        return;
      }

      const indexParts = target.dataset.index.split('-').map(Number); // Get target indices
      const [groupId, pos] = indexParts;
      const targetCollection = collectionsData[groupId].collections[pos];
      const cleanTabData = {
        title: dragState.tabData.title,
        url: dragState.tabData.url,
        favIconUrl: dragState.tabData.favIconUrl || '' // Discard id and windowId
      };
      targetCollection.tabs.push(cleanTabData); // Step 1: Append cleaned tab data to collection
      saveCollections(); // Save the collection addition immediately

      // Step 2: If Shift key is pressed, remove the live card from the live group (close the tab)
      if (e.shiftKey) {
        const tabId = dragState.tabData.id;
        const winId = dragState.tabData.windowId;
        chrome.tabs.remove(tabId, () => {
          if (chrome.runtime.lastError) {
            console.error('Error closing live card tab:', chrome.runtime.lastError);
          } else {
            console.log('Live card tab closed successfully:', { tabId });
            console.log("YYY", dragState.tabData);
            checkAndCloseEmptyWindow(winId); // Check if window is empty using captured winId
          }
          renderCollections();
          if (selectedCollectionIndex === targetCollection.collectionId) renderCollectionContent();
          loadAllTabs(); // Refresh right panel to reflect closed tab
          cleanupDrag(dragState.element);
        });
      } else {
        // Normal behavior without Shift key: no tab closure
        renderCollections();
        if (selectedCollectionIndex === targetCollection.collectionId) renderCollectionContent();
        cleanupDrag(dragState.element);
      }
    }

        // Scenario 5: Dragging a stored card from the middle panel onto a collection
        // - Condition: Target is a collection, source is 'collection-content-tab'
    // - Action: Move tab to target collection unless it’s the same collection
    else if (dragState.type === 'tab-card' && target.classList.contains('collection') && e.dataTransfer.getData('source') === 'collection-content-tab') {
      console.log('Dropping stored card from middle panel onto collection');

      if (!dragState.tabData) {
        console.error('Dragged stored card data not available');
        cleanupDrag(dragState.element);
        return;
      }

      const sourceGroupId = dragState.groupId;
      const sourcePos = dragState.pos;
      const sourceCollection = collectionsData[sourceGroupId].collections[sourcePos];
      const tabIndex = parseInt(dragState.element.dataset.index); // Index of dragged tab
      const targetIndexParts = target.dataset.index.split('-').map(Number); // Target indices
      const [targetGroupId, targetPos] = targetIndexParts;
      const targetCollection = collectionsData[targetGroupId].collections[targetPos];

      if (sourceGroupId === targetGroupId && sourcePos === targetPos) { // Same collection check
        console.log('Dropped stored card on same collection - no action taken');
        cleanupDrag(dragState.element);
        return;
      }

      const tab = sourceCollection.tabs.splice(tabIndex, 1)[0]; // Remove tab from source
      targetCollection.tabs.push(tab); // Append to target (already clean from previous drag)
      saveCollections();
      renderCollections();
      renderCollectionContent(); // Refresh middle panel
      cleanupDrag(dragState.element);
    }

        // Scenario 6: Dragging a live card from the right panel onto a live group
        // - Condition: Target is a live group (window-group)
    // - Action: Reorder within same window or move to new live group
    else if (dragState.type === 'tab-card' && target.classList.contains('window-group') && e.dataTransfer.getData('source') === 'tabs-panel-tab') {
      console.log('Dropping live card onto live group', {
        tabId: dragState.tabData ? dragState.tabData.id : 'unknown',
        targetWindowId: target.dataset.windowId
      });

      if (!dragState.tabData) {
        console.error('Dragged live card data not available');
        cleanupDrag(dragState.element);
        return;
      }

      const targetWindowId = parseInt(target.dataset.windowId); // Target window ID
      const sourceWindowId = dragState.tabData.windowId; // Source window ID
      const tabId = dragState.tabData.id; // Tab ID

      if (sourceWindowId === targetWindowId) { // Same window: reorder
        const container = target.querySelector('.tab-card-container');
        const dropIndex = getDropPositionInWindowGroup(container, e.clientX, e.clientY); // Calculate new position
        console.log('Reordering live card within live group:', { tabId, targetWindowId, dropIndex });

        chrome.tabs.move(tabId, { windowId: targetWindowId, index: dropIndex }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error reordering live card:', chrome.runtime.lastError);
          } else {
            console.log('Live card reordered successfully:', { tabId, newIndex: dropIndex });
            loadAllTabs(); // Refresh right panel
            tabsPanel.scrollTop = scrollPosition; // Restore scroll
          }
          cleanupDrag(dragState.element);
        });
      } else { // Different window: move and append
        console.log('Moving live card to new live group:', { tabId, fromWindowId: sourceWindowId, toWindowId: targetWindowId });

        chrome.tabs.move(tabId, { windowId: targetWindowId, index: -1 }, () => { // -1 appends to end
          if (chrome.runtime.lastError) {
            console.error('Error moving live card to new live group:', chrome.runtime.lastError);
          } else {
            console.log('Live card moved successfully:', { tabId, newWindowId: targetWindowId });
            loadAllTabs();
            tabsPanel.scrollTop = scrollPosition;
          }
          cleanupDrag(dragState.element);
        });
      }
    }

        // Scenario 7: Dragging a live card from the right panel onto the middle panel
        // - Condition: Target is #collection-content-panel, source is 'tabs-panel-tab'
    // - Action: Append live card to the selected collection if one is selected, discarding id and windowId
    else if (dragState.type === 'tab-card' && target.id === 'collection-content-panel' && e.dataTransfer.getData('source') === 'tabs-panel-tab') {
      console.log('Dropping live card onto middle panel', {
        tabId: dragState.tabData ? dragState.tabData.id : 'unknown',
        selectedCollectionIndex
      });

      if (!dragState.tabData) {
        console.error('Dragged live card data not available');
        cleanupDrag(dragState.element);
        return;
      }

      if (selectedCollectionIndex === null) { // No collection selected: reject
        console.error('No collection selected for live card drop on middle panel - rejecting drop');
        cleanupDrag(dragState.element);
        return;
      }

      let targetCollection = null;
      let groupId = -1;
      let pos = -1;
      for (let gIdx = 0; gIdx < collectionsData.length; gIdx++) { // Find selected collection
        const foundCol = collectionsData[gIdx].collections.find(c => c.collectionId === selectedCollectionIndex);
        if (foundCol) {
          targetCollection = foundCol;
          groupId = gIdx;
          pos = foundCol.pos;
          break;
        }
      }

      if (!targetCollection) { // Collection not found: error
        console.error('Selected collection not found in collectionsData', { selectedCollectionIndex });
        cleanupDrag(dragState.element);
        return;
      }

      const cleanTabData = {
        title: dragState.tabData.title,
        url: dragState.tabData.url,
        favIconUrl: dragState.tabData.favIconUrl || '' // Discard id and windowId
      };
      targetCollection.tabs.push(cleanTabData); // Append cleaned tab data
      saveCollections();
      renderCollections(); // Refresh left panel (tab count)
      renderCollectionContent(); // Refresh middle panel
      cleanupDrag(dragState.element);
    }

        // Scenario 8: Dragging a stored card within the middle panel
        // - Condition: Target is #collection-content-panel, source is 'collection-content-tab'
    // - Action: No action required, just cleanup
    else if (dragState.type === 'tab-card' && target.id === 'collection-content-panel' && e.dataTransfer.getData('source') === 'collection-content-tab') {
      console.log('Dropping stored card within middle panel - no action taken');
      cleanupDrag(dragState.element);
      return;
    }

        // Scenario 9: Dragging a live group from the right panel onto a collection or middle panel
        // - Condition: Target is a collection or #collection-content-panel
    // - Action: Append all tabs from the live group to the target collection, discarding id and windowId
    else if (dragState.type === 'window-group' && (target.classList.contains('collection') || target.id === 'collection-content-panel')) {
      console.log('Dropping live group onto collection/middle panel', {
        windowId: dragState.windowId,
        target: { class: target.className, id: target.id }
      });

      const collectionIndexParts = target.classList.contains('collection')
          ? target.dataset.index.split('-').map(Number)
          : (selectedCollectionIndex !== null ? selectedCollectionIndex.split('-').map(Number) : null); // Use selected if middle panel
      if (!collectionIndexParts) { // No valid target collection: reject
        console.error('No collection selected for live group drop - rejecting drop');
        cleanupDrag(dragState.element);
        return;
      }
      const [groupId, pos] = collectionIndexParts;
      if (target.classList.contains('collection')) target.classList.remove('over'); // Clear highlight

      const windowId = dragState.windowId;
      chrome.tabs.query({ windowId: windowId }, (tabs) => { // Fetch all tabs in the live group
        if (chrome.runtime.lastError) {
          console.error('Error querying live group tabs:', chrome.runtime.lastError);
          cleanupDrag(dragState.element);
          return;
        }
        const targetCollection = collectionsData[groupId].collections[pos];
        tabs.forEach(tab => { // Append each tab, discarding id and windowId
          targetCollection.tabs.push({
            title: tab.title,
            url: tab.url,
            favIconUrl: tab.favIconUrl || ''
          });
        });
        saveCollections();
        renderCollections();
        if (selectedCollectionIndex === targetCollection.collectionId) renderCollectionContent();
        loadAllTabs(); // Refresh right panel (live group still exists)
        tabsPanel.scrollTop = scrollPosition;
        cleanupDrag(dragState.element);
      });
    }

        // Scenario 10: Dragging a stored card from the middle panel onto a live group
        // - Condition: Target is a live group (window-group), source is 'collection-content-tab'
    // - Action: Open a new tab in the target window with the stored card's URL
    else if (dragState.type === 'tab-card' && target.classList.contains('window-group') && e.dataTransfer.getData('source') === 'collection-content-tab') {
      console.log('Dropping stored card onto live group', {
        url: dragState.tabData ? dragState.tabData.url : 'unknown',
        targetWindowId: target.dataset.windowId
      });

      if (!dragState.tabData || !dragState.tabData.url) {
        console.error('Dragged stored card data or URL not available');
        cleanupDrag(dragState.element);
        return;
      }

      const targetWindowId = parseInt(target.dataset.windowId); // Target live group window ID
      const url = dragState.tabData.url; // URL from stored card

      chrome.tabs.create({
        windowId: targetWindowId,
        url: url
      }, (newTab) => {
        if (chrome.runtime.lastError) {
          console.error('Error opening new tab in live group:', chrome.runtime.lastError);
        } else {
          console.log('New tab opened successfully in live group:', { tabId: newTab.id, windowId: targetWindowId, url });
          loadAllTabs(); // Refresh right panel to show new tab
          tabsPanel.scrollTop = scrollPosition; // Restore scroll position
        }
        cleanupDrag(dragState.element);
      });
    }

        // Scenario 11: Invalid drop combination (e.g., tab card on group, or other unsupported targets)
        // - Condition: No matching scenario above
    // - Action: Log error and cleanup
    else {
      console.error('Drop failed: Invalid drag type or target combination', { dragState, targetClass: target.className });
      if (dragState.element) cleanupDrag(dragState.element);
    }
  }

  // --- Tab Monitoring Functions ---
  // Compare two tab arrays to detect changes
  function hasTabsChanged(prevTabs, currTabs) {
    if (prevTabs.length !== currTabs.length) return true;
    for (let i = 0; i < prevTabs.length; i++) {
      if (prevTabs[i].id !== currTabs[i].id || prevTabs[i].windowId !== currTabs[i].windowId) {
        return true;
      }
    }
    return false;
  }

  // Scan and monitor both browser tabs and live cards every 2 seconds
  function startTabMonitoring() {
    let reloadScheduled = false; // Flag to prevent multiple reloads
    setInterval(() => {
      // Scan browser tabs
      chrome.tabs.query({}, (currentTabs) => {
        const currentTabList = currentTabs.map(tab => ({ id: tab.id, windowId: tab.windowId }));

        // Check browser tabs for no title and empty URL
        const hasInvalidBrowserTab = currentTabs.some(tab => (!tab.title || tab.title === '') && (!tab.url || tab.url === ''));

        // Scan live cards in the right panel
        const liveCards = [...tabsContent.querySelectorAll('.tab-card')];
        const hasInvalidLiveCard = liveCards.some(card => {
          const title = card.querySelector('.title-section').textContent.trim();
          const url = card.querySelector('.url-section').textContent.trim();
          return title === '' && url === '';
        });

        // Schedule reload if either browser tabs or live cards have invalid entries
        if ((hasInvalidBrowserTab || hasInvalidLiveCard) && !reloadScheduled) {
          console.log('Found invalid entry (browser tab or live card) with no title and empty URL, scheduling reload in 3s');
          reloadScheduled = true;
          setTimeout(() => {
            const currentScroll = tabsPanel.scrollTop;
            loadAllTabs();
            tabsPanel.scrollTop = currentScroll;
            reloadScheduled = false; // Reset flag after reload
          }, 3000); // 3000ms = 3 seconds
        }

        // Check for tab changes
        if (hasTabsChanged(previousTabs, currentTabList)) {
          console.log('Tab change detected, refreshing live cards');
          const currentScroll = tabsPanel.scrollTop;
          loadAllTabs(); // Refresh tabs, previousTabs updated inside loadAllTabs
          tabsPanel.scrollTop = currentScroll; // Restore scroll position
        } else {
          console.log('No tab changes detected');
        }
      });
    }, 2000); // 2000ms = 2 seconds
    console.log('Monitoring started for both browser tabs and live cards with 2-second polling');
  }

  // --- Initialization ---
  // Select a collection
  function selectCollection(collectionId) {
    selectedCollectionIndex = collectionId;
    renderCollections();
    renderCollectionContent();
  }

  // Create static Add Group button
  const addGroupBtn = document.createElement('button');
  addGroupBtn.id = 'add-group';
  addGroupBtn.textContent = '+';
  addGroupBtn.addEventListener('click', () => {
    const name = prompt('Enter group name:', `Group ${collectionsData.length + 1}`);
    if (name) {
      collectionsData.push({ name, collections: [] });
      saveCollections();
      renderCollections();
    }
  });

  // Add event listeners for export/import buttons and open all tabs
  exportCollectionsButton.addEventListener('click', exportCollections);
  importCollectionsButton.addEventListener('click', () => importCollectionsFile.click());
  importCollectionsFile.addEventListener('change', importCollections);
  openAllTabsButton.addEventListener('click', openAllTabs);
  openAllNewWindowButton.addEventListener('click', openAllInNewWindow);

  // Middle panel drag listeners
  collectionContentPanel.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (dragState.type === 'window-group' || (dragState.type === 'tab-card' && selectedCollectionIndex !== null)) { // Allow live groups or tab cards with selection
      e.dataTransfer.dropEffect = 'move';
      collectionContentPanel.classList.add('drag-over');
    } else {
      e.dataTransfer.dropEffect = 'none'; // Prevent drop for stored cards without selection
    }
  });
  collectionContentPanel.addEventListener('dragleave', () => {
    collectionContentPanel.classList.remove('drag-over');
  });
  collectionContentPanel.addEventListener('drop', drop);
  collectionContentPanel.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (dragState.type === 'window-group' || (dragState.type === 'tab-card' && selectedCollectionIndex !== null)) { // Allow live groups or tab cards with selection
      e.dataTransfer.dropEffect = 'move';
      collectionContentPanel.classList.add('drag-over');
    } else {
      e.dataTransfer.dropEffect = 'none'; // Prevent drop for stored cards without selection
    }
  });

  // Ensure at least one group exists on page load, create "Default Group" if none exist
  if (collectionsData.length === 0) {
    collectionsData.unshift({ name: 'Default Group', collections: [] });
    saveCollections();
  }

  // Initial render
  loadAllTabs(); // Initial load sets previousTabs
  renderCollections();
  renderCollectionContent();

  // Start monitoring tab changes after 5 seconds
  setTimeout(() => {
    startTabMonitoring();
  }, 5000); // 5000ms = 5 seconds
});