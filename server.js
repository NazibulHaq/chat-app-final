const express = require('express');
const http = require('http');
const session = require('express-session');
const { Server } = require('socket.io');
const path = require('path');
const { users, chats, rooms, macros } = require('./public/database');
const fs = require('fs');
const { saveMessageToSheet } = require('./google-sheets');
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json'); // path to your downloaded JSON

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const macrosFilePath = path.join(__dirname, 'macros.json');

// Load macros from file on startup
function loadMacrosFromFile() {
  try {
    if (fs.existsSync(macrosFilePath)) {
      const data = fs.readFileSync(macrosFilePath, 'utf8');
      const macroArr = JSON.parse(data);
      // Clear and repopulate the in-memory macros object
      Object.keys(macros).forEach(k => delete macros[k]);
      macroArr.forEach(macro => {
        macros[macro.keyword] = macro;
      });
    }
  } catch (err) {
    console.error('Failed to load macros from file:', err);
  }
}

// Save macros to file
function saveMacrosToFile() {
  try {
    const macroArr = Object.values(macros);
    fs.writeFileSync(macrosFilePath, JSON.stringify(macroArr, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save macros to file:', err);
  }
}

loadMacrosFromFile();

// Session
const sessionMiddleware = session({
  secret: 'super-secret-key',
  resave: false,
  saveUninitialized: true
});
app.use(sessionMiddleware);
io.use((socket, next) => sessionMiddleware(socket.request, {}, next));

// Body / Static
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.redirect('/login.html'));

// Auth check
function ensureAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login.html');
}

// Login / Signup / Logout
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const admin = users.admins.find(a => a.username === username && a.password === password);
  if (admin) {
    req.session.user = { id: admin.id, username, type: 'admin' };
    return res.redirect('/admin.html');
  }
  const agent = users.agents.find(a => a.username === username && a.password === password);
  if (agent) {
    req.session.user = { id: agent.id, username, type: 'agent' };
    return res.redirect('/user.html');
  }
  res.redirect('/login.html');
});
app.post('/signup', (req, res) => {
  const { username, password } = req.body;
  if (users.agents.find(a => a.username === username)) return res.redirect('/signup.html?error=exists');
  const id = Date.now();
  users.agents.push({ id, username, password });
  chats[id] = [];
  req.session.user = { id, username, type: 'agent' };
  res.redirect('/user.html');
});
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login.html'));
});

// Who am I?
app.get('/api/user', (req, res) => {
  if (!req.session.user) return res.status(401).send();
  res.json(req.session.user);
});

// List users (admin only), now with "type"
app.get('/api/users', ensureAuth, (req, res) => {
  if (req.session.user.type !== 'admin') return res.status(403).send();
  const adminList = users.admins.map(a => ({ id: a.id, username: a.username, type: 'admin' }));
  const agentList = users.agents.map(a => ({ id: a.id, username: a.username, type: 'agent' }));
  res.json([...adminList, ...agentList]);
});

// Create + fetch rooms
app.post('/api/rooms', ensureAuth, (req, res) => {
  if (req.session.user.type !== 'admin') return res.status(403).send();
  const roomId = Math.random().toString(36).substr(2,6).toUpperCase();
  rooms[roomId] = { users: req.body.users };
  res.json({ roomId, users: rooms[roomId].users });
});
app.get('/api/rooms', ensureAuth, (req, res) => {
  if (req.session.user.type === 'admin') return res.json(rooms);
  const u = req.session.user.id;
  const filtered = {};
  Object.keys(rooms).forEach(rid => {
    if (rooms[rid].users.includes(u)) filtered[rid] = rooms[rid];
  });
  res.json(filtered);
});

// Download history (plain-text) & JSON history
app.get('/api/chat/:userId', ensureAuth, (req, res) => {
  const uid = +req.params.userId, u = req.session.user;
  if (u.type === 'agent' && u.id !== uid) return res.status(403).send();
  const history = chats[uid]||[];
  // Map agent/admin to real usernames
  function getUsername(from) {
    if (from === 'admin') {
      // Use the admin's username from session if available, else fallback
      const admin = users.admins.find(a => a.id === (u.type === 'admin' ? u.id : 1));
      return admin ? admin.username : 'admin';
    }
    // from is agent id
    const agent = users.agents.find(a => a.id === Number(from));
    return agent ? agent.username : 'agent';
  }
  const lines = history.map(c =>
    '['+new Date(c.timestamp).toLocaleString()+'] '+getUsername(c.from)+': '+c.message
  );
  res.setHeader('Content-Disposition','attachment; filename=chat_'+uid+'.txt');
  res.send(lines.join('\n'));
});
app.get('/api/chat/:userId/history', ensureAuth, (req, res) => {
  const uid = +req.params.userId, u = req.session.user;
  if (u.type === 'agent' && u.id !== uid) return res.status(403).send();
  res.json(chats[uid]||[]);
});

// Macro API endpoints
app.post('/api/macros', ensureAuth, (req, res) => {
  if (req.session.user.type !== 'admin') return res.status(403).send();
  const { keyword, body } = req.body;
  
  // Validation
  if (!keyword || !body) return res.status(400).json({ error: 'Keyword and body are required' });
  if (keyword.length > 20) return res.status(400).json({ error: 'Keyword must be 20 characters or less' });
  if (body.length > 500) return res.status(400).json({ error: 'Body must be 500 characters or less' });
  if (!/^[a-zA-Z0-9_ %\-\.]+$/.test(keyword)) return res.status(400).json({ error: 'Keyword can only contain letters, numbers, spaces, and _-%.' });
  if (macros[keyword]) return res.status(400).json({ error: 'Keyword already exists' });

  // Create macro
  const macro = {
    id: Date.now().toString(),
    keyword,
    body,
    created_by: req.session.user.id,
    created_at: new Date().toISOString()
  };
  macros[keyword] = macro;
  saveMacrosToFile();
  res.json(macro);
});

app.get('/api/macros', ensureAuth, (req, res) => {
  res.json(Object.values(macros));
});

// Socket.IO chat relay
io.on('connection', socket => {
  const sess = socket.request.session;
  if (!sess.user) return;
  const { id, type } = sess.user;
  if (type === 'admin') socket.join('admin');
  else socket.join('user_'+id);

  // Track current room for each socket
  let currentRoomId = null;

  // Handle room selection
  socket.on('selectRoom', (roomId) => {
    currentRoomId = roomId;
  });

  socket.on('message', async data => {
    const ts = Date.now();
    let roomId;

    if (type === 'admin') {
      const to = +data.to;
      chats[to] = chats[to]||[];
      roomId = currentRoomId; // Use the admin's selected room
      const message = { from:'admin', to, message:data.message, timestamp:ts, roomId };
      chats[to].push(message);
      io.to('user_'+to).emit('message', message);
      socket.emit('message', message);

      // Save to Google Sheets and Firestore if room is selected
      if (roomId) {
        await saveMessageToSheet(roomId, message);
        await saveMessageToFirestore(roomId, message);
      }
    } else {
      chats[id] = chats[id]||[];
      // Find the roomId for this agent if not provided
      roomId = data.roomId;
      if (!roomId) {
        // Find the room(s) this agent is in
        const agentRooms = Object.keys(rooms).filter(rid => rooms[rid].users.includes(id));
        if (agentRooms.length > 0) {
          roomId = agentRooms[0];
        }
      }
      const message = { from: id, username: sess.user.username, message: data.message, timestamp: ts, roomId };
      chats[id].push(message);
      io.to('admin').emit('message', message);
      socket.emit('message', message);

      // Save to Google Sheets and Firestore if roomId is available
      if (roomId) {
        await saveMessageToSheet(roomId, message);
        await saveMessageToFirestore(roomId, message);
      }
    }
  });
});

// Permanently delete a room (admin only)
app.delete('/api/rooms/:roomId', ensureAuth, (req, res) => {
  if (req.session.user.type !== 'admin') return res.status(403).send();
  const { roomId } = req.params;
  if (rooms[roomId]) {
    delete rooms[roomId];
    // Optionally, remove related chat history from all users
    Object.keys(chats).forEach(uid => {
      if (Array.isArray(chats[uid])) {
        chats[uid] = chats[uid].filter(msg => msg.roomId !== roomId);
      }
    });
    return res.json({ success: true });
  }
  res.status(404).json({ error: 'Room not found' });
});

// Permanently delete a user (admin only)
app.delete('/api/users/:userId', ensureAuth, (req, res) => {
  if (req.session.user.type !== 'admin') return res.status(403).send();
  const userId = Number(req.params.userId);
  // Remove from agents
  const agentIdx = users.agents.findIndex(a => a.id === userId);
  if (agentIdx !== -1) {
    users.agents.splice(agentIdx, 1);
    // Remove their chat history
    delete chats[userId];
    // Remove from all rooms
    Object.keys(rooms).forEach(roomId => {
      rooms[roomId].users = rooms[roomId].users.filter(uid => uid !== userId);
      if (rooms[roomId].users.length === 0) delete rooms[roomId];
    });
    return res.json({ success: true });
  }
  // Remove from admins (if ever needed)
  const adminIdx = users.admins.findIndex(a => a.id === userId);
  if (adminIdx !== -1) {
    users.admins.splice(adminIdx, 1);
    delete chats[userId];
    Object.keys(rooms).forEach(roomId => {
      rooms[roomId].users = rooms[roomId].users.filter(uid => uid !== userId);
      if (rooms[roomId].users.length === 0) delete rooms[roomId];
    });
    return res.json({ success: true });
  }
  res.status(404).json({ error: 'User not found' });
});

// Launch
server.listen(3000, '0.0.0.0', () => {
  console.log('Listening on http://0.0.0.0:3000 (accessible from your local network)');
});

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function saveMessageToFirestore(roomId, message) {
  await db.collection('rooms').doc(roomId)
    .collection('messages')
    .add({
      ...message,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
}
