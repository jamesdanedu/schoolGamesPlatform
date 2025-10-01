// microbit-controller.js - Complete Enhanced Version for HW-484 Hall Sensor Support

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { EventEmitter } = require('events');

class FourMicrobitController extends EventEmitter {
    constructor() {
        super();
        this.connections = new Map();
        this.buttonStates = [false, false, false, false];
        this.ledStates = [false, false, false, false];
        this.buttonColors = ["GREEN", "WHITE", "RED", "GREEN"];
        this.buttonPositions = ["LEFT", "MIDDLE-LEFT", "MIDDLE-RIGHT", "RIGHT"];
        
        // Track which Microbit is which button (1-4)
        this.buttonMappings = new Map();
        this.portToButton = new Map();
        
        // HW-484 Hall Sensor Support
        this.bikePort = null; // Special port for the bike sensor
        this.bikeData = {
            revolutions: 0,
            rpm: 0,
            lastUpdateTime: 0,
            isActive: false
        };
        
        // Test mode tracking
        this.statusInterval = null;
        
        console.log('🎮 Initializing 4-Microbit Arcade Controller with Bike Sensor...');
        this.findAllMicrobits();
    }

    async findAllMicrobits() {
        try {
            const ports = await SerialPort.list();
            
            // Look for Microbit-like devices
            const microbitPorts = ports.filter(port => 
                port.manufacturer && (
                    port.manufacturer.includes('Arm') || 
                    port.manufacturer.includes('mbed') ||
                    port.manufacturer.includes('Microbit') ||
                    port.manufacturer.includes('ARM') ||
                    port.manufacturer.includes('Microsoft') ||
                    port.path.includes('usbmodem') ||
                    port.path.includes('ttyACM')
                )
            );

            console.log(`🔍 Found ${microbitPorts.length} potential Microbits:`);
            microbitPorts.forEach((port, index) => {
                console.log(`   ${index + 1}. ${port.path} (${port.manufacturer || 'Unknown'})`);
            });

            if (microbitPorts.length === 0) {
                console.log('❌ No Microbits detected. Check connections and drivers.');
                return;
            }

            // Connect to each detected Microbit
            for (let i = 0; i < microbitPorts.length; i++) {
                await this.connectToMicrobit(microbitPorts[i].path, i + 1);
                await this.delay(500);
            }

        } catch (error) {
            console.error('❌ Error finding Microbits:', error);
        }
    }

    async connectToMicrobit(portPath, suggestedButtonNumber) {
        try {
            console.log(`🔌 Attempting to connect to ${portPath}...`);
            
            const port = new SerialPort({
                path: portPath,
                baudRate: 115200,
                autoOpen: false
            });

            await new Promise((resolve, reject) => {
                port.open((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
            
            // Store connection info
            this.connections.set(portPath, { 
                port, 
                parser, 
                buttonNumber: null,
                deviceType: 'unknown', // 'button' or 'bike'
                connected: true,
                lastActivity: Date.now()
            });

            parser.on('data', (data) => {
                this.processMessage(portPath, data.trim());
            });

            port.on('error', (error) => {
                console.error(`❌ Error on ${portPath}:`, error.message);
                this.handleDisconnection(portPath);
            });

            port.on('close', () => {
                console.log(`🔌 ${portPath} disconnected`);
                this.handleDisconnection(portPath);
            });

            console.log(`✅ Connected to Microbit at ${portPath}`);
            
            // Send identification request
            setTimeout(() => {
                this.sendCommand(portPath, 'IDENTIFY');
            }, 1000);

        } catch (error) {
            console.error(`❌ Failed to connect to ${portPath}:`, error.message);
        }
    }

    processMessage(portPath, message) {
        if (!message) return;

        const connection = this.connections.get(portPath);
        if (connection) {
            connection.lastActivity = Date.now();
        }

        console.log(`📨 [${portPath}] ${message}`);

        // Auto-register bike sensor on first BIKE_REV message
        if (message.startsWith('BIKE_REV:')) {
            // Auto-register as bike sensor if not already registered
            if (!this.bikePort) {
                console.log('🔄 Auto-registering bike sensor from data message');
                this.registerBikeSensor(portPath);
            }
            this.processBikeSensorData(portPath, message);
            return;
        }

        // Explicit bike sensor registration messages
        if (message.includes('BIKE SENSOR READY') || message.includes('HW-484')) {
            this.registerBikeSensor(portPath);
            return;
        }

        // Arcade Button Messages (existing code)
        if (message.includes('BUTTON_') && message.includes('_READY')) {
            const parts = message.split('_');
            if (parts.length >= 2) {
                const buttonNumber = parseInt(parts[1]);
                this.registerButton(portPath, buttonNumber);
            }
            
        } else if (message.includes('BUTTON_') && message.includes('_PRESSED')) {
            const parts = message.split('_');
            if (parts.length >= 2) {
                const buttonNumber = parseInt(parts[1]);
                this.handleButtonPress(buttonNumber);
            }
            
        } else if (message.includes('BUTTON_') && message.includes('_RELEASED')) {
            const parts = message.split('_');
            if (parts.length >= 2) {
                const buttonNumber = parseInt(parts[1]);
                this.handleButtonRelease(buttonNumber);
            }
            
        } else if (message.includes('LED_') && message.includes('_CONFIRMED')) {
            const parts = message.split('_');
            if (parts.length >= 2) {
                const buttonNumber = parseInt(parts[1]);
                const state = parts[2] === 'ON' || parts[2] === 'TOGGLE';
                
                if (parts[2] === 'TOGGLE') {
                    this.ledStates[buttonNumber - 1] = !this.ledStates[buttonNumber - 1];
                } else {
                    this.ledStates[buttonNumber - 1] = state;
                }
                
                console.log(`💡 LED ${buttonNumber} confirmed ${this.ledStates[buttonNumber - 1] ? 'ON' : 'OFF'}`);
                this.emit('led-confirmed', { buttonId: buttonNumber, state: this.ledStates[buttonNumber - 1], port: portPath });
            }
        }
    }

    registerBikeSensor(portPath) {
        this.bikePort = portPath;
        const connection = this.connections.get(portPath);
        if (connection) {
            connection.deviceType = 'bike';
            console.log(`🚴‍♂️ Registered HW-484 Bike Sensor at ${portPath}`);
            
            this.emit('bike-sensor-ready', {
                port: portPath,
                message: 'HW-484 Hall Sensor Ready'
            });
        }
    }

    processBikeSensorData(portPath, message) {
        // Parse: "BIKE_REV:<count>:<rpm>:<time>"
        const parts = message.split(':');
        if (parts.length >= 4) {
            const revolutions = parseInt(parts[1]);
            const rpm = parseInt(parts[2]);
            const timestamp = parseInt(parts[3]);
            
            // Validation - reject invalid data
            if (isNaN(revolutions) || isNaN(rpm) || revolutions < 0 || rpm < 0) {
                console.warn('⚠️ Invalid bike sensor data:', { revolutions, rpm });
                return;
            }
            
            // Update bike data
            this.bikeData = {
                revolutions: revolutions,
                rpm: rpm,
                lastUpdateTime: Date.now(),
                isActive: rpm > 0
            };
            
            console.log(`🚴‍♂️ Bike Data - Rev: ${revolutions}, RPM: ${rpm}`);
            
            // Emit bike data event for the game
            this.emit('bike-data', {
                revolutions: revolutions,
                rpm: rpm,
                timestamp: timestamp,
                port: portPath
            });
            
            // Emit generic microbit-data for compatibility with biker-beat.js
            this.emit('microbit-data', message);
        }
    }

    registerButton(portPath, buttonNumber) {
        if (buttonNumber >= 1 && buttonNumber <= 4) {
            this.buttonMappings.set(portPath, buttonNumber);
            this.portToButton.set(buttonNumber, portPath);
            
            const connection = this.connections.get(portPath);
            if (connection) {
                connection.buttonNumber = buttonNumber;
                connection.deviceType = 'button';
            }
            
            console.log(`📍 Registered Button ${buttonNumber} at ${portPath}`);
            
            // Flash LED to confirm assignment
            setTimeout(() => {
                this.setLED(buttonNumber, true);
                setTimeout(() => this.setLED(buttonNumber, false), 500);
            }, 500);
            
            this.emit('microbit-ready', { 
                port: portPath, 
                buttonId: buttonNumber,
                message: `Button ${buttonNumber} ready`
            });
        }
    }

    handleButtonPress(buttonNumber) {
        if (buttonNumber >= 1 && buttonNumber <= 4) {
            this.buttonStates[buttonNumber - 1] = true;
            const color = this.buttonColors[buttonNumber - 1];
            const position = this.buttonPositions[buttonNumber - 1];
            
            console.log(`🎮 PRESS: ${color} Button ${buttonNumber} (${position})`);
            
            this.emit('button-press', {
                button: buttonNumber,
                color: color,
                position: position,
                state: 'pressed'
            });
        }
    }

    handleButtonRelease(buttonNumber) {
        if (buttonNumber >= 1 && buttonNumber <= 4) {
            this.buttonStates[buttonNumber - 1] = false;
            const color = this.buttonColors[buttonNumber - 1];
            const position = this.buttonPositions[buttonNumber - 1];
            
            console.log(`🎮 RELEASE: ${color} Button ${buttonNumber} (${position})`);
            
            this.emit('button-release', {
                button: buttonNumber,
                color: color,
                position: position,
                state: 'released'
            });
        }
    }

    handleDisconnection(portPath) {
        const connection = this.connections.get(portPath);
        if (connection) {
            if (connection.deviceType === 'bike' && this.bikePort === portPath) {
                console.log(`⚠️  HW-484 Bike Sensor disconnected`);
                this.bikePort = null;
                this.bikeData.isActive = false;
                this.emit('bike-sensor-disconnected', { port: portPath });
                
            } else if (connection.deviceType === 'button') {
                const buttonNumber = this.buttonMappings.get(portPath);
                if (buttonNumber) {
                    console.log(`⚠️  Button ${buttonNumber} disconnected`);
                    this.buttonStates[buttonNumber - 1] = false;
                    this.portToButton.delete(buttonNumber);
                }
                this.buttonMappings.delete(portPath);
            }
            
            this.connections.delete(portPath);
        }
    }

    // ========================================
    // BIKE SENSOR SPECIFIC METHODS
    // ========================================

    getBikeData() {
        return { ...this.bikeData };
    }

    isBikeSensorConnected() {
        return this.bikePort !== null;
    }

    sendBikeCommand(command) {
        if (!this.bikePort) {
            console.error('❌ No bike sensor connected');
            return false;
        }
        
        return this.sendCommand(this.bikePort, command);
    }

    async resetBikeCounter() {
        if (this.bikePort) {
            // Reset local data immediately
            this.bikeData = {
                revolutions: 0,
                rpm: 0,
                lastUpdateTime: Date.now(),
                isActive: false
            };
            
            // Send reset command to bike sensor Microbit
            const result = this.sendCommand(this.bikePort, 'RESET_COUNTER');
            
            if (result) {
                console.log('🔄 Bike counter reset successfully');
            }
            
            return result;
        }
        return false;
    }

    async setBikeGameMode(active) {
        if (this.bikePort) {
            const command = active ? 'GAME_MODE_ON' : 'GAME_MODE_OFF';
            return this.sendCommand(this.bikePort, command);
        }
        return false;
    }

    // Simulation and testing methods
    simulateBikeData(revolutions = 1, rpm = 60) {
        const testMessage = `BIKE_REV:${revolutions}:${rpm}:${Date.now()}`;
        console.log('🧪 Simulating bike data:', testMessage);
        
        // Process as if received from Microbit
        this.processBikeSensorData('simulated', testMessage);
        
        return testMessage;
    }

    async testBikeSensor() {
        console.log('🧪 Testing bike sensor functionality...');
        
        if (!this.isBikeSensorConnected()) {
            console.log('⚠️ No bike sensor connected - using simulation');
            
            // Simulate a series of bike data
            for (let i = 1; i <= 5; i++) {
                const rpm = 40 + (i * 10); // Increasing RPM
                this.simulateBikeData(i, rpm);
                await this.delay(1000);
            }
            
            return true;
        }
        
        // Test real bike sensor
        if (this.sendBikeCommand('TEST')) {
            console.log('✅ Test command sent to bike sensor');
            return true;
        }
        
        return false;
    }

    // ========================================
    // LED CONTROL METHODS (Existing)
    // ========================================

    async setLED(buttonNumber, state) {
        const portPath = this.portToButton.get(buttonNumber);
        
        if (!portPath) {
            console.error(`❌ No Microbit found for button ${buttonNumber}`);
            return false;
        }

        const command = state ? 'LED_ON' : 'LED_OFF';
        return this.sendCommand(portPath, command);
    }

    async setAllLEDs(state) {
        console.log(`💡 Setting ALL LEDs to ${state ? 'ON' : 'OFF'}`);
        
        const promises = [];
        for (let i = 1; i <= 4; i++) {
            promises.push(this.setLED(i, state));
        }
        
        const results = await Promise.all(promises);
        return results.every(result => result === true);
    }

    async flashLED(buttonNumber, times = 3, duration = 500) {
        console.log(`⚡ Flashing LED ${buttonNumber} ${times} times`);
        
        for (let i = 0; i < times; i++) {
            await this.setLED(buttonNumber, true);
            await this.delay(duration);
            await this.setLED(buttonNumber, false);
            if (i < times - 1) {
                await this.delay(duration);
            }
        }
    }

    async flashAllLEDs(times = 3, duration = 300) {
        console.log(`⚡ Flashing ALL LEDs ${times} times`);
        
        for (let i = 0; i < times; i++) {
            await this.setAllLEDs(true);
            await this.delay(duration);
            await this.setAllLEDs(false);
            if (i < times - 1) {
                await this.delay(duration);
            }
        }
    }

    async chaseLEDs(rounds = 2, speed = 200) {
        console.log(`🌈 Running LED chase pattern for ${rounds} rounds`);
        
        for (let round = 0; round < rounds; round++) {
            for (let i = 1; i <= 4; i++) {
                await this.setLED(i, true);
                await this.delay(speed);
                await this.setLED(i, false);
            }
        }
    }

    // ========================================
    // ENHANCED BIKE-SPECIFIC LED PATTERNS
    // ========================================

    async bikeStartPattern() {
        console.log('🚴‍♂️ Bike start LED pattern');
        // Green chase to indicate ready to ride
        for (let i = 1; i <= 4; i++) {
            await this.setLED(i, true);
            await this.delay(150);
        }
        await this.delay(500);
        await this.setAllLEDs(false);
        await this.delay(200);
        await this.flashAllLEDs(2, 200);
    }

    async bikeMilestonePattern(milestone) {
        console.log(`🚴‍♂️ Bike milestone ${milestone} pattern`);
        
        // Different patterns for each milestone
        switch(milestone) {
            case 1: // 25%
                await this.chaseLEDs(3, 100);
                break;
            case 2: // 50%
                await this.flashAllLEDs(4, 150);
                break;
            case 3: // 75%
                // Rapid chase
                for (let round = 0; round < 2; round++) {
                    for (let i = 1; i <= 4; i++) {
                        await this.setLED(i, true);
                        await this.delay(50);
                        await this.setLED(i, false);
                    }
                }
                break;
            case 4: // 100% - Victory!
                await this.bikeVictoryPattern();
                break;
        }
    }

    async bikeVictoryPattern() {
        console.log('🚴‍♂️ Bike victory LED pattern - CHAMPION!');
        
        // Epic victory sequence
        for (let i = 0; i < 5; i++) {
            await this.setAllLEDs(true);
            await this.delay(100);
            await this.setAllLEDs(false);
            await this.delay(100);
        }
        
        // Final cascade
        await this.chaseLEDs(4, 80);
        await this.setAllLEDs(true);
        await this.delay(2000);
        await this.setAllLEDs(false);
    }

    async bikeSpeedFeedback(rpm) {
        // Visual RPM feedback on LEDs
        const speedLevel = Math.min(4, Math.floor(rpm / 25)); // 25, 50, 75, 100+ RPM levels
        
        // Turn on LEDs based on speed
        for (let i = 1; i <= 4; i++) {
            await this.setLED(i, i <= speedLevel);
        }
    }

    // ========================================
    // RANDOM LED PATTERNS (Enhanced from original)
    // ========================================

    async randomLEDSequence(count = 4, onDuration = 500, offDuration = 100, totalSequences = 1) {
        console.log(`🎲 Random LED sequence: ${totalSequences} sequences of ${count} LEDs`);
        
        for (let seq = 0; seq < totalSequences; seq++) {
            const sequence = [];
            for (let i = 0; i < count; i++) {
                sequence.push(Math.floor(Math.random() * 4) + 1);
            }
            
            console.log(`   Sequence ${seq + 1}: ${sequence.join(' → ')}`);
            
            for (const led of sequence) {
                await this.setLED(led, true);
                await this.delay(onDuration);
                await this.setLED(led, false);
                await this.delay(offDuration);
            }
            
            if (seq < totalSequences - 1) {
                await this.delay(500); // Pause between sequences
            }
        }
    }

    async randomFlashSequence(sequences = 3, flashDuration = 500) {
        console.log(`⚡ Random flash sequence: ${sequences} sequences`);
        
        for (let i = 0; i < sequences; i++) {
            const randomLED = Math.floor(Math.random() * 4) + 1;
            const flashCount = Math.floor(Math.random() * 3) + 2; // 2-4 flashes
            
            console.log(`   Flash LED ${randomLED} ${flashCount} times`);
            await this.flashLED(randomLED, flashCount, flashDuration / flashCount);
            
            if (i < sequences - 1) {
                await this.delay(200);
            }
        }
    }

    async randomLEDGame(rounds = 5, speed = 600) {
        console.log(`🎮 Random LED game: ${rounds} rounds at ${speed}ms speed`);
        
        for (let round = 0; round < rounds; round++) {
            const pattern = [];
            const patternLength = Math.min(round + 2, 6); // Increasing difficulty
            
            // Generate random pattern
            for (let i = 0; i < patternLength; i++) {
                pattern.push(Math.floor(Math.random() * 4) + 1);
            }
            
            console.log(`   Round ${round + 1} pattern: ${pattern.join(' → ')}`);
            
            // Show pattern
            for (const led of pattern) {
                await this.setLED(led, true);
                await this.delay(speed);
                await this.setLED(led, false);
                await this.delay(100);
            }
            
            // Pause before next round
            if (round < rounds - 1) {
                await this.delay(800);
            }
        }
    }

    async simonSaysPattern(patternLength = 4, playbackSpeed = 800) {
        console.log(`🧠 Simon Says pattern: ${patternLength} steps at ${playbackSpeed}ms`);
        
        const pattern = [];
        for (let i = 0; i < patternLength; i++) {
            pattern.push(Math.floor(Math.random() * 4) + 1);
        }
        
        console.log(`   Pattern: ${pattern.join(' → ')}`);
        
        // Play back the pattern
        for (const led of pattern) {
            await this.setLED(led, true);
            await this.delay(playbackSpeed * 0.7);
            await this.setLED(led, false);
            await this.delay(playbackSpeed * 0.3);
        }
        
        return pattern;
    }

    async randomCascade(waves = 3, waveSpeed = 200) {
        console.log(`🌊 Random cascade: ${waves} waves at ${waveSpeed}ms`);
        
        for (let wave = 0; wave < waves; wave++) {
            const direction = Math.random() > 0.5 ? 1 : -1; // Random direction
            
            if (direction === 1) {
                // Left to right
                for (let i = 1; i <= 4; i++) {
                    await this.setLED(i, true);
                    await this.delay(waveSpeed);
                    await this.setLED(i, false);
                }
            } else {
                // Right to left
                for (let i = 4; i >= 1; i--) {
                    await this.setLED(i, true);
                    await this.delay(waveSpeed);
                    await this.setLED(i, false);
                }
            }
        }
    }

    async rhythmicRandomPattern(beats = 8, tempo = 600) {
        console.log(`🎵 Rhythmic random pattern: ${beats} beats at ${tempo}ms tempo`);
        
        for (let beat = 0; beat < beats; beat++) {
            const randomLED = Math.floor(Math.random() * 4) + 1;
            const duration = Math.random() > 0.7 ? tempo * 0.5 : tempo * 0.2; // Some longer beats
            
            await this.setLED(randomLED, true);
            await this.delay(duration);
            await this.setLED(randomLED, false);
            await this.delay(tempo - duration);
        }
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    sendCommand(portPath, command) {
        const connection = this.connections.get(portPath);
        if (!connection || !connection.connected) {
            console.error(`❌ No active connection to ${portPath}`);
            return false;
        }

        try {
            connection.port.write(command + '\n');
            console.log(`📤 Sent to ${portPath}: ${command}`);
            return true;
        } catch (error) {
            console.error(`❌ Error sending command to ${portPath}:`, error);
            return false;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getButtonStates() {
        return [...this.buttonStates];
    }

    getLEDStates() {
        return [...this.ledStates];
    }

    getConnectionStatus() {
        const buttonConnections = Array.from(this.buttonMappings.values()).length;
        const bikeConnected = this.bikePort !== null;
        
        const status = {
            connected: this.connections.size,
            buttonConnections: buttonConnections,
            bikeConnected: bikeConnected,
            bikeData: this.getBikeData(),
            total: 4 + (bikeConnected ? 1 : 0)
        };
        
        console.log('📊 Connection Status:', status);
        return status;
    }

    // Get detailed status for debugging
    getDetailedStatus() {
        const connections = Array.from(this.connections.entries()).map(([port, conn]) => ({
            port,
            type: conn.deviceType,
            buttonNumber: conn.buttonNumber || null,
            connected: conn.connected,
            lastActivity: new Date(conn.lastActivity).toLocaleTimeString()
        }));

        return {
            totalConnections: this.connections.size,
            buttonMappings: Object.fromEntries(this.buttonMappings),
            bikePort: this.bikePort,
            bikeData: this.getBikeData(),
            connections: connections
        };
    }

    // Log current system state
    logSystemState() {
        console.log('\n📊 MICROBIT SYSTEM STATE:');
        console.log('================================');
        
        const status = this.getDetailedStatus();
        
        console.log(`Total Connections: ${status.totalConnections}`);
        console.log(`Button Mappings:`, status.buttonMappings);
        console.log(`Bike Connected: ${status.bikePort ? 'YES' : 'NO'}`);
        
        if (status.bikePort) {
            console.log(`Bike Data:`, status.bikeData);
        }
        
        console.log('\nConnection Details:');
        status.connections.forEach(conn => {
            console.log(`  ${conn.port}: ${conn.type} (Button ${conn.buttonNumber || 'N/A'}) - Last: ${conn.lastActivity}`);
        });
        
        console.log('================================\n');
    }

    disconnect() {
        console.log('🔌 Disconnecting all Microbits...');
        
        // Clear status interval
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
            this.statusInterval = null;
        }
        
        for (const [portPath, connection] of this.connections) {
            try {
                if (connection.port && connection.port.isOpen) {
                    connection.port.close();
                }
                console.log(`✅ Disconnected from ${portPath}`);
            } catch (error) {
                console.error(`❌ Error disconnecting from ${portPath}:`, error);
            }
        }
        
        this.connections.clear();
        this.buttonMappings.clear();
        this.portToButton.clear();
        this.bikePort = null;
        
        // Reset bike data
        this.bikeData = {
            revolutions: 0,
            rpm: 0,
            lastUpdateTime: 0,
            isActive: false
        };
    }

    // ========================================
    // GAME EVENT PATTERNS
    // ========================================

    async gameStartPattern() {
        console.log('🎮 Game start LED pattern');
        await this.chaseLEDs(2, 150);
        await this.flashAllLEDs(2, 200);
    }

    async gameOverPattern() {
        console.log('🎮 Game over LED pattern');
        await this.setAllLEDs(true);
        await this.delay(1000);
        await this.flashAllLEDs(5, 100);
        await this.setAllLEDs(false);
    }

    async gameWinPattern() {
        console.log('🎮 Game win LED pattern');
        await this.chaseLEDs(3, 100);
        await this.setAllLEDs(false);
    }

    startTestMode() {
        console.log('\n🧪 ENHANCED 4-MICROBIT + BIKE SENSOR TEST MODE');
        console.log('Expected devices:');
        console.log('• 4 separate Microbits with arcade buttons (Green-White-Red-Green)');
        console.log('• 1 additional Microbit with HW-484 Hall Sensor for bike');
        console.log('• Total: Up to 5 Microbits for complete setup');
        console.log('\n💡 Bike sensor will auto-register on first BIKE_REV message');
        console.log('💡 Use simulateBikeData() method to test without hardware');
        console.log('\nListening for all device events...\n');

        // Test connection status every 10 seconds
        this.statusInterval = setInterval(() => {
            this.getConnectionStatus();
            
            // Show bike data if available
            if (this.isBikeSensorConnected()) {
                console.log('🚴‍♂️ Current bike data:', this.getBikeData());
            }
        }, 10000);

        // Add to window for debugging (if in renderer process)
        if (typeof window !== 'undefined') {
            window.microbitController = this;
            console.log('🐛 Debug: Controller available as window.microbitController');
            console.log('🐛 Try: window.microbitController.simulateBikeData(5, 80)');
        }
    }
}

module.exports = FourMicrobitController;
