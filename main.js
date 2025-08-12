// main.js - Electron main process
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// High scores data file
const scoresFile = path.join(__dirname, 'highscores.json');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets/icon.png'), // Add your icon
    show: false
  });

  mainWindow.loadFile('index.html');
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Optional: Open DevTools in development
  // mainWindow.webContents.openDevTools();
}

// High scores management
function loadHighScores() {
  try {
    if (fs.existsSync(scoresFile)) {
      const data = fs.readFileSync(scoresFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading high scores:', error);
  }
  
  // Default high scores structure
  return {
    pong: [],
    snake: [],
    flappybird: [],
    rhythmtimer: [],
    stopthesprite: []
  };
}

function saveHighScores(scores) {
  try {
    fs.writeFileSync(scoresFile, JSON.stringify(scores, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving high scores:', error);
    return false;
  }
}

// IPC handlers for high scores
ipcMain.handle('get-high-scores', async (event, game) => {
  const scores = loadHighScores();
  return game ? scores[game] || [] : scores;
});

ipcMain.handle('save-high-score', async (event, game, playerName, score) => {
  const scores = loadHighScores();
  
  if (!scores[game]) {
    scores[game] = [];
  }
  
  scores[game].push({
    name: playerName,
    score: score,
    date: new Date().toISOString()
  });
  
  // Sort by score (descending) and keep top 10
  scores[game].sort((a, b) => b.score - a.score);
  scores[game] = scores[game].slice(0, 10);
  
  const success = saveHighScores(scores);
  return { success, scores: scores[game] };
});

// Microbit/Hardware communication setup
ipcMain.handle('setup-microbit', async () => {
  // This would integrate with Microbit via serial communication
  // You'll need to add the serialport package: npm install serialport
  try {
    // Example setup for future Microbit integration
    console.log('Setting up Microbit communication...');
    return { success: true, message: 'Microbit setup ready' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// App event handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Prevent navigation away from the app
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (url !== contents.getURL()) {
      event.preventDefault();
    }
  });
});
