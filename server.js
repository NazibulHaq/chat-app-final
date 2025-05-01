const express = require('express');
const http = require('http');
const session = require('express-session');
const { Server } = require('socket.io');
const path = require('path');
const { users, chats, rooms } = require('./public/database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

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

// Socket.IO chat relay
io.on('connection', socket => {
  const sess = socket.request.session;
  if (!sess.user) return;
  const { id, type } = sess.user;
  if (type === 'admin') socket.join('admin');
  else socket.join('user_'+id);

  socket.on('message', data => {
    const ts = Date.now();
    if (type === 'admin') {
      const to = +data.to;
      chats[to] = chats[to]||[];
      chats[to].push({ from:'admin', to, message:data.message, timestamp:ts });
      io.to('user_'+to).emit('message',{ from:'admin', to, message:data.message, timestamp:ts });
      socket.emit('message',{ from:'admin', to, message:data.message, timestamp:ts });
    } else {
      chats[id] = chats[id]||[];
      chats[id].push({ from:'agent', message:data.message, timestamp:ts });
      io.to('admin').emit('message',{ from:id, message:data.message, timestamp:ts });
      socket.emit('message',{ from:'agent', message:data.message, timestamp:ts });
    }
  });
});

// Launch
server.listen(3000, '0.0.0.0', () => {
  console.log('Listening on http://0.0.0.0:3000 (accessible from your local network)');
});
