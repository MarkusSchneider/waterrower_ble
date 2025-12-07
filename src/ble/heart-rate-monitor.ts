import debug from 'debug';
import { EventEmitter } from 'events';
import { Subject } from 'rxjs';

import noble, { Peripheral, Characteristic } from '@stoprocent/noble';

const logger = debug('HR_MONITOR');

// Standard Bluetooth Heart Rate Service and Characteristic UUIDs
const HEART_RATE_SERVICE_UUID = '180d';
const HEART_RATE_MEASUREMENT_UUID = '2a37';

export interface HeartRateData {
    time: number;
    heartRate: number;
}

export class HeartRateMonitor extends EventEmitter {
    private peripheral?: Peripheral;
    private characteristic?: Characteristic;
    private connected = false;

    // Subject for publishing heart rate data
    public heartRate$ = new Subject<HeartRateData>();

    constructor() {
        super();
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
                await this.connectAsync(savedDeviceId, 30000); // 30 seconds timeout
                logger('Successfully connected to saved HRM device in background');
                return; // Exit on successful connection
            } catch (err: any) {
                logger(`Background connection attempt ${attempts + 1} to HRM failed: ${err.message}`);
                // Continue to next attempt
            }
        }

        logger('Max background connection attempts reached for HRM device');
    }

    public async discoverAsync(): Promise<Array<{ id: string; name: string | undefined }>> {
        await noble.waitForPoweredOnAsync();
        logger('Noble powered on, starting discovery...');

        const devices: Array<{ id: string; name: string | undefined }> = [];
        const discoveryTimeout = 10000;
        const startTime = Date.now();

        // Start scanning for heart rate devices
        await noble.startScanningAsync([HEART_RATE_SERVICE_UUID], false);

        for await (const peripheral of noble.discoverAsync()) {
            const name = peripheral.advertisement.localName;
            const hasHeartRateService = peripheral.advertisement.serviceUuids?.includes(HEART_RATE_SERVICE_UUID);

            if (!devices.find(d => d.id === peripheral.id)) {
                devices.push({ id: peripheral.id, name });
                logger(`Discovered device: ${name} - HR Service: ${hasHeartRateService}`);
            }

            // Check timeout
            if (Date.now() - startTime >= discoveryTimeout) {
                break;
            }
        }

        await noble.stopScanningAsync();

        logger(`Discovery complete. Found ${devices.length} devices.`);
        return devices;
    }

    public async connectAsync(deviceId?: string, timeout = 30000): Promise<void> {
        if (deviceId == null) {
            return;
        }

        if (this.connected) {
            logger('Already connected to heart rate monitor');
            return;
        }

        // Create a promise that rejects after timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Heart rate monitor connection timeout')), timeout);
        });

        // Race between connection and timeout
        await Promise.race([
            this.connectToDeviceAsync(deviceId),
            timeoutPromise
        ]);
    }

    private async connectToDeviceAsync(deviceId: string): Promise<void> {
        await noble.waitForPoweredOnAsync();
        logger(`Connecting directly to device: ${deviceId}`);

        // Direct connection without scanning
        const peripheral = await noble.connectAsync(deviceId);
        await this.connectToPeripheralAsync(peripheral);
    }

    private async connectToPeripheralAsync(peripheral: Peripheral): Promise<void> {
        this.peripheral = peripheral;

        logger(`Connecting to ${peripheral.advertisement.localName}...`);

        // Setup disconnect handler
        peripheral.once('disconnect', () => {
            logger('Heart rate monitor disconnected');
            this.connected = false;
            this.peripheral = undefined;
            this.characteristic = undefined;
            this.emit('disconnected');
        });

        // Connect to peripheral
        await peripheral.connectAsync();
        logger('Connected! Discovering services and characteristics...');

        // Discover all services and characteristics at once (following peripheral-explorer pattern)
        const { services } = await peripheral.discoverAllServicesAndCharacteristicsAsync();

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
        this.emit('connected');
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

        // Also emit as event for backward compatibility
        this.emit('heartrate', heartRate);
    }

    public getDeviceName(): string {
        return this.peripheral?.advertisement.localName ?? 'Unknown Device';
    }
}
