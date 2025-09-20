// test-serial-ports.js - Run this to see what ports are available
// Save this file and run: node test-serial-ports.js

const { SerialPort } = require('serialport');

async function listAllPorts() {
    try {
        console.log('🔍 Scanning for all serial ports...\n');
        
        const ports = await SerialPort.list();
        
        if (ports.length === 0) {
            console.log('❌ No serial ports found!');
            console.log('💡 Make sure Microbits are connected and drivers are installed.');
            return;
        }
        
        console.log(`📋 Found ${ports.length} serial ports:\n`);
        
        ports.forEach((port, index) => {
            console.log(`${index + 1}. ${port.path}`);
            console.log(`   Manufacturer: ${port.manufacturer || 'Unknown'}`);
            console.log(`   Vendor ID: ${port.vendorId || 'N/A'}`);
            console.log(`   Product ID: ${port.productId || 'N/A'}`);
            console.log(`   Serial Number: ${port.serialNumber || 'N/A'}`);
            
            // Check if it looks like a Microbit
            const manufacturer = (port.manufacturer || '').toLowerCase();
            const vendorId = port.vendorId || '';
            const productId = port.productId || '';
            
            const isMicrobit = 
                manufacturer.includes('arm') || 
                manufacturer.includes('mbed') ||
                vendorId === '0d28' || 
                productId === '0204';
                
            if (isMicrobit) {
                console.log('   ✅ LOOKS LIKE A MICROBIT!');
            } else if (port.path.toLowerCase().includes('com')) {
                console.log('   🤔 COM port - might be a Microbit');
            }
            
            console.log('   ---\n');
        });
        
        // Show potential Microbits
        const microbitPorts = ports.filter(port => {
            const manufacturer = (port.manufacturer || '').toLowerCase();
            const vendorId = port.vendorId || '';
            const productId = port.productId || '';
            
            return manufacturer.includes('arm') || 
                   manufacturer.includes('mbed') ||
                   vendorId === '0d28' || 
                   productId === '0204';
        });
        
        if (microbitPorts.length > 0) {
            console.log(`🎮 Detected ${microbitPorts.length} potential Microbits:`);
            microbitPorts.forEach(port => {
                console.log(`   - ${port.path}`);
            });
        } else {
            console.log('⚠️  No obvious Microbits detected by vendor/product ID');
            
            // Show all COM ports as fallback
            const comPorts = ports.filter(port => 
                port.path.toLowerCase().includes('com')
            );
            
            if (comPorts.length > 0) {
                console.log('\n🔍 All COM ports (try these manually):');
                comPorts.forEach(port => {
                    console.log(`   - ${port.path}`);
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Error listing ports:', error);
    }
}

// Test connection to a specific port
async function testPort(portPath) {
    console.log(`\n🧪 Testing connection to ${portPath}...`);
    
    try {
        const port = new SerialPort({
            path: portPath,
            baudRate: 115200,
            autoOpen: false
        });
        
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout'));
            }, 3000);
            
            port.open((err) => {
                clearTimeout(timeout);
                if (err) reject(err);
                else resolve();
            });
        });
        
        console.log(`✅ Successfully connected to ${portPath}`);
        
        port.close();
        console.log(`🔌 Disconnected from ${portPath}`);
        
    } catch (error) {
        console.log(`❌ Failed to connect to ${portPath}: ${error.message}`);
    }
}

// Main execution
listAllPorts().then(() => {
    console.log('\n💡 If you see COM ports above, try updating the detection in your controller!');
    console.log('💡 On Windows, Microbits usually appear as COM3, COM4, etc.');
    console.log('💡 Check Device Manager > Ports (COM & LPT) to see active ports');
});