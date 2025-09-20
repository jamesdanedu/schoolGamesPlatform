// microbit-controller.js for 4 separate Microbits

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { EventEmitter } = require('events');

class FourMicrobitController extends EventEmitter {
    constructor() {
        super();
        this.connections = new Map(); // Maps port path to connection info
        this.buttonStates = [false, false, false, false];
        this.ledStates = [false, false, false, false];
        this.buttonColors = ["GREEN", "WHITE", "RED", "GREEN"];
        this.buttonPositions = ["LEFT", "MIDDLE-LEFT", "MIDDLE-RIGHT", "RIGHT"];
        
        // Track which Microbit is which button (1-4)
        this.buttonMappings = new Map(); // Maps port path to button number
        this.portToButton = new Map();   // Maps button number to port path
        
        console.log('🎮 Initializing 4-Microbit Arcade Controller...');
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
                console.log('💡 Make sure each Microbit is connected and has the button code loaded.');
                return;
            }

            // Connect to each detected Microbit
            for (let i = 0; i < microbitPorts.length; i++) {
                await this.connectToMicrobit(microbitPorts[i].path, i + 1);
                // Small delay between connections
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

            // Open the port
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
                buttonNumber: null, // Will be set when Microbit identifies itself
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

        if (message.includes('BUTTON_') && message.includes('_READY')) {
            // Your code: "BUTTON_1_GREEN_READY", "BUTTON_2_WHITE_READY", etc.
            const parts = message.split('_');
            if (parts.length >= 2) {
                const buttonNumber = parseInt(parts[1]);
                this.registerButton(portPath, buttonNumber);
            }
            
        } else if (message.includes('BUTTON_') && message.includes('_PRESSED')) {
            // Your code: "BUTTON_1_PRESSED", "BUTTON_2_PRESSED", etc.
            const parts = message.split('_');
            if (parts.length >= 2) {
                const buttonNumber = parseInt(parts[1]);
                this.handleButtonPress(buttonNumber);
            }
            
        } else if (message.includes('BUTTON_') && message.includes('_RELEASED')) {
            // Your code: "BUTTON_1_RELEASED", "BUTTON_2_RELEASED", etc.
            const parts = message.split('_');
            if (parts.length >= 2) {
                const buttonNumber = parseInt(parts[1]);
                this.handleButtonRelease(buttonNumber);
            }
            
        } else if (message.includes('LED_') && message.includes('_CONFIRMED')) {
            // Your code: "LED_1_ON_CONFIRMED", "LED_1_OFF_CONFIRMED", etc.
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
            
        } else if (message.includes('PONG_')) {
            // Your code: "PONG_1", "PONG_2", etc.
            const buttonNumber = parseInt(message.split('_')[1]);
            console.log(`🏓 Pong received from Button ${buttonNumber}`);
        }
    }

    registerButton(portPath, buttonNumber) {
        if (buttonNumber >= 1 && buttonNumber <= 4) {
            this.buttonMappings.set(portPath, buttonNumber);
            this.portToButton.set(buttonNumber, portPath);
            
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

    getNextAvailableButton() {
        for (let i = 1; i <= 4; i++) {
            if (!this.portToButton.has(i)) {
                return i;
            }
        }
        return null;
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
            const buttonNumber = this.buttonMappings.get(portPath);
            if (buttonNumber) {
                console.log(`⚠️  Button ${buttonNumber} disconnected`);
                this.buttonStates[buttonNumber - 1] = false;
                this.portToButton.delete(buttonNumber);
            }
            
            this.buttonMappings.delete(portPath);
            this.connections.delete(portPath);
        }
    }

    // LED Control Methods
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

    // Utility Methods
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
        const status = {
            connected: this.connections.size,
            mappings: Object.fromEntries(this.buttonMappings),
            total: 4
        };
        
        console.log('📊 Connection Status:', status);
        return status;
    }

    disconnect() {
        console.log('🔌 Disconnecting all Microbits...');
        
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
    }

    // Game-specific patterns (adapted for 4 separate Microbits)
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
        console.log('\n🧪 4-MICROBIT TEST MODE ACTIVE');
        console.log('Expected: 4 separate Microbits, each with 1 arcade button');
        console.log('Button layout: Green(L) → White → Red → Green(R)');
        console.log('Listening for button events and auto-assigning...\n');

        // Test connection status every 5 seconds
        setInterval(() => {
            this.getConnectionStatus();
        }, 5000);
    }
}

module.exports = FourMicrobitController;