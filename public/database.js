const users = {
  admins: [
    { id:1, username:'admin1', password:'pass1' },
    { id:2, username:'admin2', password:'pass2' },
    { id:3, username:'admin3', password:'pass3' }
  ],
  agents: []
};
const chats = {};
const rooms = {};
const macros = {}; // Store macros with keyword as key
module.exports = { users, chats, rooms, macros };
