let socket, currentUser, allUsers = [], rooms = {},
    currentRoomId = null, currentChatUserId = null,
    unreadCounts = {}, // roomId: count
    unreadTabCounts = {}; // userId: count (for admin tabs)

// Import grammar check modules
import grammarCheckService from './grammar-check.js';
import grammarUI from './grammar-ui.js';

// Helpers
function clearContainer(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

// Append message as bubble
function appendMessage(data) {
  const msgs = document.getElementById('messages');
  const div = document.createElement('div');
  // apply bubble classes
  const cls = data.from === 'admin' ? 'admin' : 'agent';
  div.classList.add('message', cls);
  // sender label for agent
  if (data.from !== 'admin' && data.username) {
    const sender = document.createElement('span');
    sender.className = 'sender-label';
    sender.textContent = data.username;
    div.append(sender);
  }
  // message text and timestamp
  const text = document.createElement('div');
  // Escape HTML and preserve line breaks
  function escapeHTML(str) {
    return str.replace(/[&<>"']/g, function(tag) {
      const charsToReplace = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return charsToReplace[tag] || tag;
    });
  }
  text.innerHTML = escapeHTML(data.message).replace(/\n/g, '<br>');
  const time = document.createElement('span');
  time.classList.add('timestamp');
  time.textContent = new Date(data.timestamp).toLocaleTimeString();
  div.append(text, time);
  msgs.append(div);
  msgs.scrollTop = msgs.scrollHeight;
}

// Load chat history
function loadHistory(userId) {
  fetch(`/api/chat/${userId}/history`)
    .then(r => r.json())
    .then(arr => {
      clearContainer(document.getElementById('messages'));
      arr.forEach(appendMessage);
    });
}

// Switch rooms
function selectRoom(roomId) {
  currentRoomId = roomId;
  // Save last selected room for persistence
  if (currentUser.type !== 'admin') {
    localStorage.setItem('lastRoomId', roomId);
  }
  // Emit room selection event
  socket.emit('selectRoom', roomId);
  // highlight room in sidebar
  document.querySelectorAll('#rooms-list li').forEach(li => {
    li.classList.toggle('active', li.dataset.roomId === roomId);
    // Reset badge for opened room
    if (li.dataset.roomId === roomId) {
      unreadCounts[roomId] = 0;
      const badge = li.querySelector('.badge');
      if (badge) badge.remove();
    }
  });
  if (currentUser.type === 'admin') {
    const tabs = document.getElementById('tabs-container');
    clearContainer(tabs);
    rooms[roomId].users.forEach(uid => {
      const user = allUsers.find(u => u.id === uid);
      if (!user) return;
      const btn = document.createElement('button');
      // Username label
      const label = document.createElement('span');
      label.className = 'tab-label';
      label.textContent = user.username;
      btn.appendChild(label);
      btn.dataset.userid = uid;
      btn.onclick = () => selectTab(uid);
      // Badge (if needed)
      if (unreadTabCounts[uid] > 0) {
        const badge = document.createElement('span');
        badge.className = 'tab-badge';
        badge.textContent = unreadTabCounts[uid];
        btn.appendChild(badge);
      }
      tabs.append(btn);
    });
    const firstBtn = tabs.querySelector('button');
    if (firstBtn) selectTab(firstBtn.dataset.userid);
  } else {
    document.getElementById('room-title').textContent = `Room ${roomId} / Chat with Admin`;
    selectTab(currentUser.id);
  }
}

// Switch user tab
function selectTab(userId) {
  currentChatUserId = String(userId);
  document.querySelectorAll('#tabs-container button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.userid === userId);
    // Reset badge for opened tab
    if (btn.dataset.userid === userId) {
      unreadTabCounts[userId] = 0;
      const badge = btn.querySelector('.tab-badge');
      if (badge) badge.remove();
    }
  });
  loadHistory(userId);
}

// Init
fetch('/api/user')
  .then(r => r.status === 401 ? location.href = '/login.html' : r.json())
  .then(user => {
    currentUser = user;
    // Show username in user header if not admin
    if (user.type !== 'admin') {
      const el = document.getElementById('user-username');
      if (el) el.innerText = `(@${user.username})`;
    }
    socket = io();

    document.getElementById('logout').onclick = () => location.href = '/logout';

    socket.on('message', data => {
      if (currentUser.type === 'admin') {
        if ((data.from === 'admin' && String(data.to) === currentChatUserId) ||
            (String(data.from) === currentChatUserId && data.to === undefined)) {
          appendMessage(data);
        } else {
          // Message for another user tab (room)
          let roomId = currentRoomId;
          let userId = String(data.from);
          // Find the roomId for this user
          Object.keys(rooms).forEach(rid => {
            if (rooms[rid].users.includes(Number(data.from))) roomId = rid;
          });
          if (roomId && roomId !== currentRoomId) {
            unreadCounts[roomId] = (unreadCounts[roomId] || 0) + 1;
            updateRoomBadges();
          }
          // For admin tabs
          if (userId !== currentChatUserId) {
            unreadTabCounts[userId] = (unreadTabCounts[userId] || 0) + 1;
            updateTabBadges();
          }
        }
      } else {
        // Agent: if not in current room, show badge
        if (String(currentRoomId) !== String(data.roomId)) {
          unreadCounts[data.roomId] = (unreadCounts[data.roomId] || 0) + 1;
          updateRoomBadges();
        }
        appendMessage(data);
      }
    });

    // Fetch users and rooms
    fetch('/api/users').then(r => r.json()).then(list => {
      allUsers = list;
      if (user.type === 'admin') {
        // Render custom user list for create room
        const userListDiv = document.getElementById('user-list');
        let selectedUserIds = [];
        function renderUserList() {
          userListDiv.innerHTML = '';
          list.filter(u => u.type === 'agent').forEach(u => {
            const item = document.createElement('div');
            item.className = 'user-list-item' + (selectedUserIds.includes(u.id) ? ' selected' : '');
            item.dataset.userId = u.id;
            
            // Create item content wrapper
            const itemContent = document.createElement('div');
            itemContent.className = 'item-content';
            
            // Avatar
            const avatar = document.createElement('div');
            avatar.className = 'user-avatar';
            avatar.textContent = u.username[0].toUpperCase();
            itemContent.appendChild(avatar);
            
            // Info
            const info = document.createElement('div');
            info.className = 'user-info';
            const name = document.createElement('div');
            name.className = 'user-name';
            name.textContent = u.username;
            info.appendChild(name);
            const meta = document.createElement('div');
            meta.className = 'user-meta';
            meta.textContent = 'Online';
            info.appendChild(meta);
            itemContent.appendChild(info);
            
            // Add ellipsis menu
            const ellipsisMenu = createEllipsisMenu('user', u.id);
            
            // Add click handler for selection
            itemContent.onclick = () => {
              if (selectedUserIds.includes(u.id)) {
                selectedUserIds = selectedUserIds.filter(id => id !== u.id);
              } else {
                selectedUserIds.push(u.id);
              }
              renderUserList();
            };
            
            item.appendChild(itemContent);
            item.appendChild(ellipsisMenu);
            userListDiv.appendChild(item);
          });
        }
        renderUserList();
        document.getElementById('create-room').onclick = () => {
          if (selectedUserIds.length === 0) return;
          fetch('/api/rooms', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ users: selectedUserIds })
          })
          .then(r => r.json())
          .then(json => {
            rooms[json.roomId] = { users: json.users };
            const ul = document.getElementById('rooms-list');
            const li = document.createElement('li');
            li.textContent = 'Room ' + json.roomId;
            li.dataset.roomId = json.roomId;
            li.onclick = () => selectRoom(json.roomId);
            ul.append(li);
            selectRoom(json.roomId);
            selectedUserIds = [];
            renderUserList();
          });
        };
      }
      fetch('/api/rooms').then(r => r.json()).then(obj => {
        rooms = obj;
        renderRoomList();
        
        // Auto-select last room if available (user only)
        if (currentUser.type !== 'admin') {
          const lastRoomId = localStorage.getItem('lastRoomId');
          if (lastRoomId && document.querySelector(`#rooms-list li[data-room-id='${lastRoomId}']`)) {
            selectRoom(lastRoomId);
            return;
          }
        }
        const firstLi = document.querySelector('#rooms-list li');
        if (firstLi) selectRoom(firstLi.dataset.roomId);
      });
    });

    // Download chat
    const downloadBtn = document.getElementById('download-chat');
    if (downloadBtn) {
      downloadBtn.onclick = () => {
        window.location = `/api/chat/${currentChatUserId}`;
      };
    }
    // Send message
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    if (messageForm && messageInput) {
      messageForm.onsubmit = e => {
        e.preventDefault();
        const msg = messageInput.innerText;
        if (!msg.trim()) return;
        const payload = currentUser.type === 'admin'
          ? { to: currentChatUserId, message: msg }
          : { message: msg, roomId: currentRoomId };
        socket.emit('message', payload);
        messageInput.innerHTML = '';
        // If admin, clear tab badge for the user being replied to
        if (currentUser.type === 'admin') {
          unreadTabCounts[currentChatUserId] = 0;
          updateTabBadges();
        }
      };
    }
  });

function updateRoomBadges() {
  document.querySelectorAll('#rooms-list li').forEach(li => {
    const roomId = li.dataset.roomId;
    let badge = li.querySelector('.badge');
    if (unreadCounts[roomId] > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'badge';
        li.appendChild(badge);
      }
      badge.textContent = unreadCounts[roomId];
    } else if (badge) {
      badge.remove();
    }
  });
}

function updateTabBadges() {
  document.querySelectorAll('#tabs-container button').forEach(btn => {
    const userId = btn.dataset.userid;
    let label = btn.querySelector('.tab-label');
    if (!label) {
      label = document.createElement('span');
      label.className = 'tab-label';
      label.textContent = btn.textContent;
      btn.textContent = '';
      btn.appendChild(label);
    }
    let badge = btn.querySelector('.tab-badge');
    if (unreadTabCounts[userId] > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'tab-badge';
        btn.appendChild(badge);
      }
      badge.textContent = unreadTabCounts[userId];
    } else if (badge) {
      badge.remove();
    }
  });
}

// Create ellipsis menu
function createEllipsisMenu(type, id) {
  const template = document.getElementById('ellipsis-menu-template');
  const menu = template.content.cloneNode(true);
  const ellipsisMenu = menu.querySelector('.ellipsis-menu');
  const ellipsisBtn = menu.querySelector('.ellipsis-btn');
  const deleteBtn = menu.querySelector('.delete-btn');

  // Handle ellipsis button click
  ellipsisBtn.onclick = (e) => {
    e.stopPropagation();
    document.querySelectorAll('.ellipsis-menu.active').forEach(menu => {
      if (menu !== ellipsisMenu) menu.classList.remove('active');
    });
    ellipsisMenu.classList.toggle('active');
  };

  // Handle delete button click
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    showConfirmationModal(type, id);
  };

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!ellipsisMenu.contains(e.target)) {
      ellipsisMenu.classList.remove('active');
    }
  });

  return ellipsisMenu;
}

// Show confirmation modal
function showConfirmationModal(type, id) {
  const template = document.getElementById('confirmation-modal-template');
  const modal = template.content.cloneNode(true);
  const modalOverlay = modal.querySelector('.modal-overlay');
  const cancelBtn = modal.querySelector('.cancel-btn');
  const confirmBtn = modal.querySelector('.confirm-btn');

  // Handle cancel
  cancelBtn.onclick = () => {
    document.body.removeChild(modalOverlay);
  };

  // Handle confirm
  confirmBtn.onclick = () => {
    if (type === 'room') {
      deleteRoom(id);
    } else if (type === 'user') {
      deleteUser(id);
    }
    document.body.removeChild(modalOverlay);
  };

  document.body.appendChild(modalOverlay);
  modalOverlay.classList.add('active');
}

// Delete room
function deleteRoom(roomId) {
  // Call backend to delete room
  fetch(`/api/rooms/${roomId}`, { method: 'DELETE' })
    .then(r => r.json())
    .then(res => {
      if (res.success) {
        // Remove room from UI
        const roomElement = document.querySelector(`#rooms-list li[data-room-id="${roomId}"]`);
        if (roomElement) {
          roomElement.remove();
        }
        // Remove room from data
        delete rooms[roomId];
        // If current room was deleted, select first available room
        if (currentRoomId === roomId) {
          const firstRoom = document.querySelector('#rooms-list li');
          if (firstRoom) {
            selectRoom(firstRoom.dataset.roomId);
          } else {
            clearContainer(document.getElementById('tabs-container'));
            clearContainer(document.getElementById('messages'));
          }
        }
      } else {
        alert(res.error || 'Failed to delete room.');
      }
    });
}

// Delete user
function deleteUser(userId) {
  // Call backend to delete user
  fetch(`/api/users/${userId}`, { method: 'DELETE' })
    .then(r => r.json())
    .then(res => {
      if (res.success) {
        // Remove user from all rooms
        Object.keys(rooms).forEach(roomId => {
          const room = rooms[roomId];
          if (room.users.includes(userId)) {
            room.users = room.users.filter(id => id !== userId);
            if (room.users.length === 0) {
              deleteRoom(roomId);
            }
          }
        });
        // Remove user from UI
        const userElement = document.querySelector(`#user-list .user-list-item[data-user-id="${userId}"]`);
        if (userElement) {
          userElement.remove();
        }
        // Remove user from data
        allUsers = allUsers.filter(user => user.id !== userId);
      } else {
        alert(res.error || 'Failed to delete user.');
      }
    });
}

// Update the room list rendering
function renderRoomList() {
  const ul = document.getElementById('rooms-list');
  ul.innerHTML = '';
  Object.keys(rooms).forEach(rid => {
    const li = document.createElement('li');
    li.dataset.roomId = rid;
    
    // Create item content wrapper
    const itemContent = document.createElement('div');
    itemContent.className = 'item-content';
    
    // Add avatar
    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    let label = rid;
    if (rooms[rid].users && allUsers.length > 0) {
      let userId = (currentUser.type === 'admin')
        ? rooms[rid].users.find(uid => uid !== currentUser.id)
        : rooms[rid].users.find(uid => uid !== 1);
      const user = allUsers.find(u => u.id === userId);
      if (user) label = user.username[0].toUpperCase();
    }
    avatar.textContent = label[0].toUpperCase();
    itemContent.appendChild(avatar);
    
    // Room name
    const span = document.createElement('span');
    span.textContent = 'Room ' + rid;
    itemContent.appendChild(span);
    
    // Add click handler
    itemContent.onclick = () => selectRoom(rid);
    
    // Add ellipsis menu
    const ellipsisMenu = createEllipsisMenu('room', rid);
    
    li.appendChild(itemContent);
    li.appendChild(ellipsisMenu);
    ul.appendChild(li);
  });
}

// Update the user list rendering
function renderUserList() {
  userListDiv.innerHTML = '';
  list.filter(u => u.type === 'agent').forEach(u => {
    const item = document.createElement('div');
    item.className = 'user-list-item' + (selectedUserIds.includes(u.id) ? ' selected' : '');
    item.dataset.userId = u.id;
    
    // Create item content wrapper
    const itemContent = document.createElement('div');
    itemContent.className = 'item-content';
    
    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar';
    avatar.textContent = u.username[0].toUpperCase();
    itemContent.appendChild(avatar);
    
    // Info
    const info = document.createElement('div');
    info.className = 'user-info';
    const name = document.createElement('div');
    name.className = 'user-name';
    name.textContent = u.username;
    info.appendChild(name);
    const meta = document.createElement('div');
    meta.className = 'user-meta';
    meta.textContent = 'Online';
    info.appendChild(meta);
    itemContent.appendChild(info);
    
    // Add click handler for selection
    itemContent.onclick = () => {
      if (selectedUserIds.includes(u.id)) {
        selectedUserIds = selectedUserIds.filter(id => id !== u.id);
      } else {
        selectedUserIds.push(u.id);
      }
      renderUserList();
    };
    
    // Add ellipsis menu
    const ellipsisMenu = createEllipsisMenu('user', u.id);
    
    item.appendChild(itemContent);
    item.appendChild(ellipsisMenu);
    userListDiv.appendChild(item);
  });
}

// Helper to set caret at a specific character offset in contenteditable
function setCaretPosition(element, offset) {
  element.focus();
  const range = document.createRange();
  const sel = window.getSelection();
  let currentNode = element;
  let currentOffset = 0;
  let found = false;

  function traverse(node) {
    if (found) return;
    if (node.nodeType === 3) { // text node
      const nextOffset = currentOffset + node.length;
      if (offset <= nextOffset) {
        range.setStart(node, offset - currentOffset);
        range.collapse(true);
        found = true;
      } else {
        currentOffset = nextOffset;
      }
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        traverse(node.childNodes[i]);
        if (found) break;
      }
    }
  }
  traverse(element);
  if (!found) {
    range.selectNodeContents(element);
    range.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

const messageInput = document.getElementById('message-input');
if (messageInput) {
  let debounceTimer;
  messageInput.addEventListener('input', async (e) => {
    const text = messageInput.innerText;
    const caretOffset = getCaretCharacterOffsetWithin(messageInput);
    clearTimeout(debounceTimer);
    // Store the text at the time of debounce
    const debounceText = text;
    debounceTimer = setTimeout(async () => {
      const result = await grammarCheckService.checkText(debounceText);
      // Only update if the input hasn't changed since debounce started
      if (messageInput.innerText === debounceText) {
        if (result && result.matches && result.matches.length > 0) {
          const highlightedText = grammarUI.highlightErrors(debounceText, result.matches);
          messageInput.dataset.originalText = debounceText;
          messageInput.innerHTML = highlightedText;
          setCaretPosition(messageInput, caretOffset);
        } else {
          // Only update cache, do not touch innerHTML or caret
          messageInput.dataset.originalText = debounceText;
        }
      }
    }, grammarCheckService.debounceTimeout);
  });

  // Handle grammar error clicks
  messageInput.addEventListener('click', (e) => {
    const error = e.target.closest('.grammar-error');
    if (error) {
      const rect = error.getBoundingClientRect();
      const word = error.textContent;
      const matches = grammarCheckService.cache.get(messageInput.dataset.originalText)?.matches;
      if (matches) {
        const match = matches.find(m => m.offset <= getCaretCharacterOffsetWithin(messageInput) &&
                                     m.offset + m.length >= getCaretCharacterOffsetWithin(messageInput));
        if (match) {
          grammarUI.showSuggestions(word, match.replacements, rect, match.message);
        }
      }
    }
  });

  // Hide suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.grammar-suggestion-popup') &&
        !e.target.closest('.grammar-error')) {
      grammarUI.hideSuggestions();
    }
  });
}

// Helper to get caret offset in contenteditable
function getCaretCharacterOffsetWithin(element) {
  let caretOffset = 0;
  const sel = window.getSelection();
  if (sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    caretOffset = preCaretRange.toString().length;
  }
  return caretOffset;
}
