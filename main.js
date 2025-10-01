// main.js - Electron main process with complete bike sensor integration
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
  console.log('🎮 Initializing Microbit Arcade Controller + Bike Sensor...');
  
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

    // ========================================
    // BIKE SENSOR EVENT LISTENERS
    // ========================================

    microbitController.on('bike-sensor-ready', (data) => {
      console.log(`🚴‍♂️ Bike sensor ready: ${data.message}`);
      mainWindow.webContents.send('bike-sensor-status', {
        status: 'connected',
        message: data.message,
        port: data.port
      });
    });

    microbitController.on('bike-data', (data) => {
      // Forward bike sensor data to renderer process for the game
      console.log(`🚴‍♂️ Bike data: Rev ${data.revolutions}, RPM ${data.rpm}`);
      mainWindow.webContents.send('bike-sensor-data', data);
    });

    microbitController.on('bike-sensor-disconnected', (data) => {
      console.log(`⚠️ Bike sensor disconnected: ${data.port}`);
      mainWindow.webContents.send('bike-sensor-status', {
        status: 'disconnected',
        port: data.port
      });
    });

    // *** ADD THIS: Generic microbit-data event for compatibility ***
    microbitController.on('microbit-data', (data) => {
      // Generic data event for compatibility with biker-beat.js
      mainWindow.webContents.send('microbit-data', data);
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
    const status = microbitController.getConnectionStatus();
    return { 
      connected: status.connected > 0,
      buttonStates: microbitController.getButtonStates(),
      connectionCount: status.connected,
      bikeConnected: status.bikeConnected || false,
      bikeData: microbitController.getBikeData ? microbitController.getBikeData() : null
    };
  }
  return { connected: false, bikeConnected: false };
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

// ========================================
// BIKE SENSOR IPC HANDLERS
// ========================================

ipcMain.handle('get-bike-sensor-status', async () => {
  if (microbitController) {
    return {
      connected: microbitController.isBikeSensorConnected ? microbitController.isBikeSensorConnected() : false,
      data: microbitController.getBikeData ? microbitController.getBikeData() : null
    };
  }
  return { connected: false, data: null };
});

ipcMain.handle('get-bike-data', async () => {
  return microbitController && microbitController.getBikeData ? microbitController.getBikeData() : null;
});

ipcMain.handle('reset-bike-counter', async () => {
  try {
    if (microbitController && microbitController.resetBikeCounter) {
      const result = await microbitController.resetBikeCounter();
      return { success: result };
    }
    // Fallback: reset bike data manually
    if (microbitController && microbitController.bikeData) {
      microbitController.bikeData = {
        revolutions: 0,
        rpm: 0,
        lastUpdateTime: 0,
        isActive: false
      };
      return { success: true };
    }
    return { success: false, error: 'Microbit controller not available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-bike-game-mode', async (event, active) => {
  try {
    if (microbitController && microbitController.setBikeGameMode) {
      const result = await microbitController.setBikeGameMode(active);
      return { success: result };
    }
    // Fallback: just return success for compatibility
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// *** ADD THESE: Missing bike sensor test/debug handlers ***
ipcMain.handle('test-bike-sensor', async () => {
  try {
    if (microbitController && microbitController.bikePort) {
      // Send test command to bike sensor
      if (microbitController.sendBikeCommand) {
        microbitController.sendBikeCommand('TEST');
      }
      return { success: true, message: 'Test command sent to bike sensor' };
    }
    return { success: false, error: 'No bike sensor connected' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('simulate-bike-data', async (event, revolutions, rpm) => {
  try {
    if (microbitController) {
      // Simulate bike data for testing
      const testData = {
        revolutions: revolutions || 1,
        rpm: rpm || 60,
        timestamp: Date.now(),
        port: 'simulated'
      };
      
      console.log('🧪 Simulating bike data:', testData);
      mainWindow.webContents.send('bike-sensor-data', testData);
      mainWindow.webContents.send('microbit-data', `BIKE_REV:${testData.revolutions}:${testData.rpm}:${testData.timestamp}`);
      
      return { success: true, data: testData };
    }
    return { success: false, error: 'Microbit controller not available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ========================================
// BIKE-SPECIFIC LED PATTERNS
// ========================================

ipcMain.handle('bike-start-pattern', async () => {
  try {
    if (microbitController && microbitController.bikeStartPattern) {
      await microbitController.bikeStartPattern();
      return { success: true };
    }
    // Fallback: use game start pattern
    if (microbitController && microbitController.gameStartPattern) {
      await microbitController.gameStartPattern();
      return { success: true };
    }
    return { success: false, error: 'Microbit controller not available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('bike-milestone-pattern', async (event, milestone) => {
  try {
    if (microbitController && microbitController.bikeMilestonePattern) {
      await microbitController.bikeMilestonePattern(milestone);
      return { success: true };
    }
    // Fallback: use chase pattern
    if (microbitController && microbitController.chaseLEDs) {
      await microbitController.chaseLEDs(2, 150);
      return { success: true };
    }
    return { success: false, error: 'Microbit controller not available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('bike-victory-pattern', async () => {
  try {
    if (microbitController && microbitController.bikeVictoryPattern) {
      await microbitController.bikeVictoryPattern();
      return { success: true };
    }
    // Fallback: use game win pattern
    if (microbitController && microbitController.gameWinPattern) {
      await microbitController.gameWinPattern();
      return { success: true };
    }
    return { success: false, error: 'Microbit controller not available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('bike-speed-feedback', async (event, rpm) => {
  try {
    if (microbitController && microbitController.bikeSpeedFeedback) {
      await microbitController.bikeSpeedFeedback(rpm);
      return { success: true };
    }
    // Fallback: flash LEDs based on speed
    if (microbitController && microbitController.flashAllLEDs) {
      const flashCount = Math.min(Math.max(1, Math.floor(rpm / 20)), 5);
      const flashSpeed = Math.max(100, 500 - (rpm * 5));
      await microbitController.flashAllLEDs(flashCount, flashSpeed);
      return { success: true };
    }
    return { success: false, error: 'Microbit controller not available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ========================================
// EXISTING LED CONTROL IPC HANDLERS
// ========================================

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
