let socket, currentUser, allUsers = [], rooms = {},
    currentRoomId = null, currentChatUserId = null,
    unreadCounts = {}, // roomId: count
    unreadTabCounts = {}; // userId: count (for admin tabs)

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
  // message text and timestamp
  const text = document.createElement('div');
  text.textContent = data.message;
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
            item.onclick = () => {
              if (selectedUserIds.includes(u.id)) {
                selectedUserIds = selectedUserIds.filter(id => id !== u.id);
              } else {
                selectedUserIds.push(u.id);
              }
              renderUserList();
            };
            // Avatar
            const avatar = document.createElement('div');
            avatar.className = 'user-avatar';
            avatar.textContent = u.username[0].toUpperCase();
            item.appendChild(avatar);
            // Info
            const info = document.createElement('div');
            info.className = 'user-info';
            const name = document.createElement('div');
            name.className = 'user-name';
            name.textContent = u.username;
            info.appendChild(name);
            const meta = document.createElement('div');
            meta.className = 'user-meta';
            meta.textContent = 'Online'; // Placeholder, can be replaced with real status
            info.appendChild(meta);
            item.appendChild(info);
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
        const ul = document.getElementById('rooms-list');
        ul.innerHTML = '';
        Object.keys(obj).forEach(rid => {
          const li = document.createElement('li');
          // Add avatar
          const avatar = document.createElement('span');
          avatar.className = 'avatar';
          // Use first letter of room id or user name if available
          let label = rid;
          if (rooms[rid].users && allUsers.length > 0) {
            // For agent, show admin avatar; for admin, show first agent
            let userId = (currentUser.type === 'admin')
              ? rooms[rid].users.find(uid => uid !== currentUser.id)
              : rooms[rid].users.find(uid => uid !== 1); // fallback
            const user = allUsers.find(u => u.id === userId);
            if (user) label = user.username[0].toUpperCase();
          }
          avatar.textContent = label[0].toUpperCase();
          li.appendChild(avatar);
          // Room name
          const span = document.createElement('span');
          span.textContent = 'Room ' + rid;
          li.appendChild(span);
          li.dataset.roomId = rid;
          li.onclick = () => selectRoom(rid);
          ul.appendChild(li);
        });
        // Auto-select last room if available (user only)
        if (currentUser.type !== 'admin') {
          const lastRoomId = localStorage.getItem('lastRoomId');
          if (lastRoomId && ul.querySelector(`li[data-room-id='${lastRoomId}']`)) {
            selectRoom(lastRoomId);
            return;
          }
        }
        const firstLi = ul.querySelector('li');
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
    document.getElementById('message-form').onsubmit = e => {
      e.preventDefault();
      const msg = document.getElementById('message-input').value;
      const payload = user.type === 'admin'
        ? { to: currentChatUserId, message: msg }
        : { message: msg };
      socket.emit('message', payload);
      document.getElementById('message-input').value = '';
      // If admin, clear tab badge for the user being replied to
      if (user.type === 'admin') {
        unreadTabCounts[currentChatUserId] = 0;
        updateTabBadges();
      }
    };
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
