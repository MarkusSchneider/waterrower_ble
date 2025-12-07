import debug from 'debug';
import { EventEmitter } from 'events';
import { Subject } from 'rxjs';

import noble, { Peripheral, Characteristic } from '@stoprocent/noble';
import { HeartRateMonitorEvents } from './heart-rate-monitor-events';

const logger = debug('HR_MONITOR');

// Standard Bluetooth Heart Rate Service and Characteristic UUIDs
const HEART_RATE_SERVICE_UUID = '180d';
const HEART_RATE_MEASUREMENT_UUID = '2a37';
const DISCOVERTY_TIMEOUT = 10000;

// Generic Access Service and Device Name Characteristic UUIDs
const GENERIC_ACCESS_SERVICE_UUID = '1800';
const DEVICE_NAME_CHARACTERISTIC_UUID = '2a00';

// Battery Service and Battery Level Characteristic UUIDs
const BATTERY_SERVICE_UUID = '180f';
const BATTERY_LEVEL_CHARACTERISTIC_UUID = '2a19';
export interface HeartRateData {
    time: number;
    heartRate: number;
}

export class HeartRateMonitor extends EventEmitter {
    private peripheral?: Peripheral;
    private characteristic?: Characteristic;
    private connected = false;
    private deviceName = '';
    private batteryLevel: number | null = null;

    // Subject for publishing heart rate data
    public heartRate$ = new Subject<HeartRateData>();

    constructor() {
        super();
        noble.setMaxListeners(20);
    }

    public async reconnectAsync(savedDeviceId: string | undefined): Promise<void> {
        if (savedDeviceId == null) {
            return;
        }

        await noble.waitForPoweredOnAsync();

        logger(`Starting background connection to saved HRM device: ${savedDeviceId}`);
        const maxAttempts = 30;
        for (let attempts = 0; attempts < maxAttempts; attempts++) {
            try {
                await Promise.race([
                    this.connectAsync(savedDeviceId),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 30000))
                ]);

                logger('Successfully connected to saved HRM device in background');
                return;
            } catch (err: any) {
                logger(`Background connection attempt ${attempts + 1} to HRM failed: ${err.message}`);
                // Continue to next attempt
            }
        }

        logger('Max background connection attempts reached for HRM device');
    }

    public async discoverAsync(): Promise<Array<{ id: string; name: string | undefined }>> {

        const devices: Array<{ id: string; name: string | undefined }> = [];
        const handleDiscovery = (peripheral: Peripheral) => {
            if (devices.find(d => d.id === peripheral.id) == null) {
                const name = peripheral.advertisement.localName;
                devices.push({ id: peripheral.id, name });

                logger(`Discovered device: ${name}`);
            }
        };

        try {
            await noble.waitForPoweredOnAsync();
            logger('Noble powered on, starting discovery...');

            await noble.startScanningAsync([HEART_RATE_SERVICE_UUID], false);
            noble.on('discover', handleDiscovery);

            await new Promise(resolve => setTimeout(resolve, DISCOVERTY_TIMEOUT));
        } finally {

            await noble.stopScanningAsync();
        }

        logger(`Discovery complete. Found ${devices.length} devices.`);
        return devices;
    }

    public async connectAsync(deviceId?: string): Promise<void> {
        if (deviceId == null) {
            return;
        }

        if (this.connected) {
            logger('Already connected to heart rate monitor');
            return;
        }

        await noble.waitForPoweredOnAsync();
        logger(`Connecting directly to device: ${deviceId}`);

        // Direct connection without scanning
        const peripheral = await noble.connectAsync(deviceId);
        await this.connectToPeripheralAsync(deviceId, peripheral);
    }

    private async connectToPeripheralAsync(deviceId: string, peripheral: Peripheral): Promise<void> {
        this.peripheral = peripheral;

        logger(`Connecting to ${deviceId}...`);

        // Setup disconnect handler
        peripheral.once('disconnect', () => {
            logger('Heart rate monitor disconnected');
            this.connected = false;
            this.peripheral = undefined;
            this.characteristic = undefined;
            this.emit(HeartRateMonitorEvents.DISCONNECTED);
        });

        // Discover all services and characteristics at once (following peripheral-explorer pattern)
        const { services } = await peripheral.discoverAllServicesAndCharacteristicsAsync();

        // Try to read device name from Generic Access Service if not available from advertisement
        const gapService = services.find(s => s.uuid === GENERIC_ACCESS_SERVICE_UUID);
        if (gapService) {
            const deviceNameChar = gapService.characteristics.find(c => c.uuid === DEVICE_NAME_CHARACTERISTIC_UUID);
            if (deviceNameChar) {
                try {
                    const nameBuffer = await deviceNameChar.readAsync();
                    this.deviceName = nameBuffer.toString('utf8');
                    logger(`Read device name from characteristic: ${this.deviceName}`);
                } catch (err) {
                    this.deviceName = 'Unknown Device';
                    logger(`Failed to read device name from characteristic: ${err}`);
                }
            }
        }

        // Try to read battery level from Battery Service if available
        const batteryService = services.find(s => s.uuid === BATTERY_SERVICE_UUID);
        if (batteryService) {
            const batteryLevelChar = batteryService.characteristics.find(c => c.uuid === BATTERY_LEVEL_CHARACTERISTIC_UUID);
            if (batteryLevelChar) {
                try {
                    const batteryBuffer = await batteryLevelChar.readAsync();
                    this.batteryLevel = batteryBuffer.readUInt8(0);
                    logger(`Read battery level: ${this.batteryLevel}%`);
                } catch (err) {
                    logger(`Failed to read battery level: ${err}`);
                }
            }
        }

        // Find heart rate service
        const hrService = services.find(s => s.uuid === HEART_RATE_SERVICE_UUID);
        if (!hrService) {
            throw new Error('Heart rate service not found');
        }

        // Find heart rate measurement characteristic
        this.characteristic = hrService.characteristics.find(c => c.uuid === HEART_RATE_MEASUREMENT_UUID);
        if (!this.characteristic) {
            throw new Error('Heart rate measurement characteristic not found');
        }

        logger('Subscribing to heart rate notifications...');

        // Subscribe to notifications
        await this.characteristic.subscribeAsync();

        // Setup data handler
        this.characteristic.on('data', (data: Buffer) => {
            this.parseHeartRateData(data);
        });

        logger('Successfully subscribed to heart rate data');
        this.connected = true;
        this.emit(HeartRateMonitorEvents.CONNECTED);
    }

    public async disconnectAsync(): Promise<void> {
        if (this.peripheral && this.connected) {
            logger('Disconnecting from heart rate monitor...');
            await this.peripheral.disconnectAsync();
            this.connected = false;
        }
    }

    public isConnected(): boolean {
        return this.connected;
    }

    private parseHeartRateData(data: Buffer): void {
        // Parse according to Bluetooth Heart Rate Measurement specification
        // https://www.bluetooth.com/specifications/gatt/characteristics/

        const flags = data.readUInt8(0);
        const is16Bit = (flags & 0x01) !== 0;

        let heartRate: number;

        if (is16Bit) {
            heartRate = data.readUInt16LE(1);
        } else {
            heartRate = data.readUInt8(1);
        }

        // logger(`Heart Rate: ${ heartRate } bpm`);

        // Publish to subject
        this.heartRate$.next({ time: Date.now(), heartRate });
    }

    public getDeviceName(): string {
        return this.deviceName;
    }

    public getBatteryLevel(): number | null {
        return this.batteryLevel;
    }
}
