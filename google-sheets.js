const { google } = require('googleapis');

// Initialize the Google Sheets API client
const auth = new google.auth.GoogleAuth({
  credentials: {
    type: "service_account",
    project_id: "chatapp-integration",
    private_key_id: "7370fc2853dc023430416fb893c7371b87f300e0",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCrX1Hm5Ye09fLr\nThNxWRkWV5/fXu1iU0Qw3S09FJTCf27ZVY9sV69PVxMpSDxs1Y9X+L6Wxi9aj+9F\nuLVsGOfvvGTIqEDq031/g/Id5OG/kI02WY0dEsHM7UlSSCKMdV4VO2UrKEMcWy88\nlN6bgAQm992j6q6LVxfQ6/+nuJaWPB3CyPRvsWOyFBGIMuFTOEOPrdgns8boeXdN\np3XVl1aPwdKwAXr7m/7HYlQZ2gFBFs1cPpDDzBD6dMN+QS0CYHB6ESD/Tgn1cVm5\nUSJ9dI4zxNP6D649c8eDYXBoehS2gHcilkgoT8C6OpfgNLXTR+/ITc2zPZDn2oQ0\n5LAUkNODAgMBAAECggEALyPXyC9wTodvLGn8MCxFmd89o3idzPPBqL1WgdxE9WGP\ncOo3uyI9n5IAu9TahkeSmCzc5GWcxgkc1O1zvkn1lv0YLhgWT2IgvfBiK/X3YTYW\nmhI1Hn+33rKQ/jjIhCGO4UFG2YHIQCcXDc+Xkme6/KsnBT17iOnKq9YXK6A7kBSC\neNUVU3UTYm431e8HfEGYQe9zel/JZgjeXkPbgwsl/sIQg0XFBs/N1qM4bzffSDL9\ndHoRUYkUM9SDpUQjk/0sb87JZ93qTgPzX7tdWuMUq/9v/HCd30Jt931Ez689Qdks\nO4vXSX58E0bkuvrXTeTJm//mqwNk8IlEhwoIzCDDNQKBgQDn43UKHNubTU3GRQki\nr0jpu+mv9RWrlXSTL6gsNhkTxz6WuA8j+urgb+3l3HNy9ZO/M1PVnPSTLRv3FeVv\nCHtAP/N4fgcbf8e0fso/J7oYu9RMeGf3PQRPoSvO6iPT0zv6iyeodmybbDN/qtsq\nycSecHaixYYK1XABwtRtAT6nBwKBgQC9MQIpH/S8Ll0io7xUrdiF+em5yoYjtIQh\nEi+vp7v9cYMjWq+dS03IoMkWBuxL4MqGPW3j2VY02ST5V1s2N6DkWpbbT/JtxoJ/\nAy1NgjZhASLrjQkP5+ZUockT5pUQL5FlRWp6yG8R0zcDnpMdeDuws+Ne47gFeuS7\niqEqoIB0pQKBgQDZC5+bDZPH8z1e3XNFkcevbwG2frH/3m407iB88U3bo1zD+hfB\n17RMyrdjtUoiShY2mrZXdQe/UjOgvE/583hZlQIwv9WrOZkVKq/nGSooyHZX9UNq\nuSP13KeCjslmFYtIYUOHfQD/IPG7B5MIo75zhlSk2jkynsCuBUyLkuSvtQKBgC05\nc9zEyMnbA2RuY2ySifmsvdQtt1b9pcAKCuAgZm21HrXqzaP6BkP5O1hKm12gBImG\nUahvoY3MgmwgF6ukLI+pn/oY6EiZdURLTB8FC16w2NoZwprMwmBktB5Ptj5CQK1G\npKdpFjPam4H//AbFYO9icO2T3b9hmx/BibkY2NwJAoGAfbcmZrRXVv7e89QdrGJA\ntw7DIL6noV4nO4yjtyge3XmwWHZIW+kR6l+Rpau6NTkOD3JQkv50dTZs5jUsZxB6\nq6QhEwQdLMWBWq5c1CtRjARc4r4sHWHMLAq7ZjFxzpKLlOdzoIPVYOnUHJjgYTiA\nKMankGGSzpjkInyEQeoC82Q=\n-----END PRIVATE KEY-----\n",
    client_email: "chatappserviceaccount@chatapp-integration.iam.gserviceaccount.com",
    client_id: "105687805118446897162",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/chatappserviceaccount%40chatapp-integration.iam.gserviceaccount.com",
    universe_domain: "googleapis.com"
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

// Function to save a chat message to Google Sheets
async function saveMessageToSheet(roomId, message) {
  try {
    // Get the current timestamp
    const timestamp = new Date().toLocaleString();

    // Determine sender and userId for the sheet
    let sender = '';
    let userId = '';
    if (message.from === 'admin') {
      sender = 'admin';
      userId = message.to || '';
    } else {
      sender = message.username || 'agent';
      userId = message.from;
    }

    // Prepare the row data
    const rowData = [
      timestamp,
      roomId,
      sender,
      userId,
      message.message
    ];

    // Append the row to the sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: '1DHTSr5Q8DRSZp6WKlINDqKxUoQoMkk0o8L6YazT-6pI', // Just the ID part from the URL
      range: 'Sheet1!A:E', // Assuming columns are: Timestamp, Room ID, Sender, User ID, Message
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [rowData]
      }
    });

    console.log('Message saved to Google Sheets successfully');
  } catch (error) {
    console.error('Error saving message to Google Sheets:', error);
  }
}

module.exports = { saveMessageToSheet }; 