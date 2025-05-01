# Simple Chat Application

This boilerplate provides a local chat app with two user types: Admins and General Users (Agents).

## Features

- Admins: 3 fixed accounts (`admin1`/`pass1`, `admin2`/`pass2`, `admin3`/`pass3`).
- Agents: can sign up with a custom username/password.
- Real-time chat using Socket.IO.
- Admins can create rooms by selecting multiple agents and chat individually.
- Download chat history as a text file per user.
- Session-based login/logout.
- Sidebar with rooms and per-user tabs for admins.
- Clean, modern UI with CSS.

## Setup & Run

```bash
# 1. Clone or copy project folder
cd chat-app-final

# 2. Install dependencies
npm install

# 3. Start server
npm start
```

Open your browser to `http://localhost:3000/login.html`.

### Connect from other devices on same WiFi

1. Find your machine's local IP: `ifconfig` (mac/linux) or `ipconfig` (Windows).
2. Replace `localhost` with your IP, e.g.: `http://192.168.1.100:3000/login.html`.
