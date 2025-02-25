# MTM-MyTabManager-Browser-Extension
My Tab Manager is a Chrome/Edge extension to organize, save, and manage your browser tabs effortlessly.

It runs locally, no account linking, no cloud sync, nothing online.

With a three-panel interface, it lets you handle live tabs and stored collections via intuitive drag-and-drop actions.

# How to Use
Install:
Currently only local install in developer mode.

Open:
New tab (Ctrl+T)
or
Click the Tab Manager icon in your toolbar.

# Panels
- Right: See live groups (windows) and live cards (tabs). Sort ("S"), hibernate ("H"), or close ("X").
- Middle: View/edit stored cards in a selected collection. Drag live cards here to save (and close it with Shift key pressed).
- Left: Create and manage groups/collections with "+". Drag to reorder.

# Drag & Drop
My Tab Manager supports intuitive drag-and-drop actions to organize your tabs across collections (left panel), stored cards (middle panel), and live groups/cards (right panel). Here’s what you can do:

| **Drag From**            | **Drop Onto**               | **Action**                                                                                   |
|--------------------------|-----------------------------|---------------------------------------------------------------------------------------------|
| **Live Card** (Right)    | **Collection** (Left)       | Adds the tab to the collection. Hold **Shift** to close the tab after adding.               |
| **Live Card** (Right)    | **Middle Panel**            | Adds the tab to the selected collection (requires a collection to be selected).             |
| **Live Card** (Right)    | **Live Card** (Right)       | Reorders the tab to the target card’s position within the same window group.                |
| **Live Card** (Right)    | **Live Group** (Right)      | Reorders within the same window (if not on a card) or moves to a different window’s end.    |
| **Live Group** (Right)   | **Collection** (Left)       | Adds all tabs from the group to the target collection.                                      |
| **Live Group** (Right)   | **Middle Panel**            | Adds all tabs from the group to the selected collection (requires a collection selected).   |
| **Stored Card** (Middle) | **Live Group** (Right)      | Opens the card’s URL as a new tab in the target window group, appending it to the end.      |
| **Stored Card** (Middle) | **Collection** (Left)       | Moves the card to the target collection (no action if it’s the same collection).            |
| **Stored Card** (Middle) | **Stored Card** (Middle)    | Reorders the card to the target card’s position in the current collection.                  |
| **Collection** (Left)    | **Collection/Group** (Left) | Moves the collection to the target group, reordering it among other collections.            |

Changes are saved automatically, and the interface updates instantly after each action.

# Bugs
Some.
