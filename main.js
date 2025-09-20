// main.js - Electron main process
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Add the Microbit controller
const FourMicrobitController = require('./microbit-controller');

// High scores data file
const scoresFile = path.join(__dirname, 'highscores.json');

let mainWindow;
let microbitController = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets/icon.png'),
    show: false
  });

  mainWindow.loadFile('index.html');
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Initialize Microbit controller when window is ready
    initializeMicrobitController();
  });

  mainWindow.webContents.openDevTools();
}

function initializeMicrobitController() {
  console.log('🎮 Initializing Microbit Arcade Controller...');
  
  try {
    microbitController = new FourMicrobitController();
    
    // Listen for button events
    microbitController.on('button-press', (data) => {
      console.log(`Main process: Button ${data.button} (${data.color}) pressed`);
      
      // Send to renderer process (your games)
      mainWindow.webContents.send('microbit-button-press', data);
    });

    microbitController.on('button-release', (data) => {
      console.log(`Main process: Button ${data.button} (${data.color}) released`);
      
      // Send to renderer process (your games)  
      mainWindow.webContents.send('microbit-button-release', data);
    });

    microbitController.on('microbit-ready', (data) => {
      console.log(`Microbit ready: ${data.message}`);
      mainWindow.webContents.send('microbit-status', { 
        status: 'connected',
        message: data.message 
      });
    });

    // Start test mode for debugging
    microbitController.startTestMode();

  } catch (error) {
    console.error('Failed to initialize Microbit controller:', error);
  }
}

// ========================================
// MICROBIT IPC HANDLERS
// ========================================

// Basic Microbit handlers
ipcMain.handle('get-microbit-status', async () => {
  if (microbitController) {
    return { 
      connected: true,
      buttonStates: microbitController.getButtonStates(),
      connectionCount: microbitController.connections.size
    };
  }
  return { connected: false };
});

ipcMain.handle('get-button-states', async () => {
  return microbitController ? microbitController.getButtonStates() : [false, false, false, false];
});

ipcMain.handle('restart-microbit-controller', async () => {
  try {
    if (microbitController) {
      microbitController.disconnect();
    }
    
    setTimeout(() => {
      initializeMicrobitController();
    }, 1000);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Basic LED Control IPC Handlers
ipcMain.handle('set-led', async (event, buttonNumber, state) => {
  try {
    if (microbitController) {
      const result = await microbitController.setLED(buttonNumber, state);
      return { success: result };
    }
    return { success: false, error: 'Microbit controller not available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-all-leds', async (event, state) => {
  try {
    if (microbitController) {
      const result = await microbitController.setAllLEDs(state);
      return { success: result };
    }
    return { success: false, error: 'Microbit controller not available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('flash-led', async (event, buttonNumber, times = 3, duration = 500) => {
  try {
    if (microbitController) {
      await microbitController.flashLED(buttonNumber, times, duration);
      return { success: true };
    }
    return { success: false, error: 'Microbit controller not available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('flash-all-leds', async (event, times = 3, duration = 300) => {
  try {
    if (microbitController) {
      await microbitController.flashAllLEDs(times, duration);
      return { success: true };
    }
    return { success: false, error: 'Microbit controller not available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('chase-leds', async (event, rounds = 2, speed = 200) => {
  try {
    if (microbitController) {
      await microbitController.chaseLEDs(rounds, speed);
      return { success: true };
    }
    return { success: false, error: 'Microbit controller not available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Random LED Pattern IPC Handlers
ipcMain.handle('random-led-sequence', async (event, count = 4, onDuration = 500, offDuration = 100, totalSequences = 1) => {
  try {
    if (microbitController) {
      await microbitController.randomLEDSequence(count, onDuration, offDuration, totalSequences);
      return { success: true };
    }
    return { success: false, error: 'Microbit controller not available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('random-flash-sequence', async (event, sequences = 3, flashDuration = 500) => {
  try {
    if (microbitController) {
      await microbitController.randomFlashSequence(sequences, flashDuration);
      return { success: true };
    }
    return { success: false, error: 'Microbit controller not available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('random-led-game', async (event, rounds = 5, speed = 600) => {
  try {
    if (microbitController) {
      await microbitController.randomLEDGame(rounds, speed);
      return { success: true };
    }
    return { success: false, error: 'Microbit controller not available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('simon-says-pattern', async (event, patternLength = 4, playbackSpeed = 800) => {
  try {
    if (microbitController) {
      const pattern = await microbitController.simonSaysPattern(patternLength, playbackSpeed);
      return { success: true, pattern: pattern };
    }
    return { success: false, error: 'Microbit controller not available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('random-cascade', async (event, waves = 3, waveSpeed = 200) => {
  try {
    if (microbitController) {
      await microbitController.randomCascade(waves, waveSpeed);
      return { success: true };
    }
    return { success: false, error: 'Microbit controller not available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('rhythmic-random-pattern', async (event, beats = 8, tempo = 600) => {
  try {
    if (microbitController) {
      await microbitController.rhythmicRandomPattern(beats, tempo);
      return { success: true };
    }
    return { success: false, error: 'Microbit controller not available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Game Event LED Pattern IPC Handlers
ipcMain.handle('game-start-pattern', async (event) => {
  try {
    if (microbitController) {
      await microbitController.gameStartPattern();
      return { success: true };
    }
    return { success: false, error: 'Microbit controller not available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('game-over-pattern', async (event) => {
  try {
    if (microbitController) {
      await microbitController.gameOverPattern();
      return { success: true };
    }
    return { success: false, error: 'Microbit controller not available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('game-win-pattern', async (event) => {
  try {
    if (microbitController) {
      await microbitController.gameWinPattern();
      return { success: true };
    }
    return { success: false, error: 'Microbit controller not available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-led-states', async (event) => {
  try {
    if (microbitController) {
      return { 
        success: true, 
        ledStates: microbitController.getLEDStates() 
      };
    }
    return { success: false, error: 'Microbit controller not available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Testing/Debug IPC Handlers
ipcMain.handle('ping-microbit', async (event, buttonNumber) => {
  try {
    if (microbitController) {
      const result = await microbitController.pingMicrobit(buttonNumber);
      return { success: result };
    }
    return { success: false, error: 'Microbit controller not available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ping-all-microbits', async (event) => {
  try {
    if (microbitController) {
      await microbitController.pingAllMicrobits();
      return { success: true };
    }
    return { success: false, error: 'Microbit controller not available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ========================================
// HIGH SCORES (Your existing code)
// ========================================

function loadHighScores() {
  try {
    if (fs.existsSync(scoresFile)) {
      const data = fs.readFileSync(scoresFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading high scores:', error);
  }
  
  return {
    pong: [],
    snake: [],
    flappybird: [],
    rhythmtimer: [],
    stopthesprite: [],
    streamstop: [],
    wirebuzzer: [],
    bikerbeat: []
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

// Existing IPC handlers for high scores
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
  
  scores[game].sort((a, b) => b.score - a.score);
  scores[game] = scores[game].slice(0, 10);
  
  const success = saveHighScores(scores);
  return { success, scores: scores[game] };
});

// ========================================
// APP EVENT HANDLERS
// ========================================

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // Clean up Microbit controller
  if (microbitController) {
    microbitController.disconnect();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Clean up on quit
app.on('before-quit', () => {
  if (microbitController) {
    console.log('🔌 Cleaning up Microbit controller...');
    microbitController.disconnect();
  }
});