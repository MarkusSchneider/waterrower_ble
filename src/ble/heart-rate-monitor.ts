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
    private scanning = false;

    // Subject for publishing heart rate data
    public heartRate$ = new Subject<HeartRateData>();

    constructor(savedDeviceId?: string) {
        super();

        // Setup noble state change handler
        noble.on('stateChange', (state) => {
            logger(`Noble state changed to: ${state}`);
            if (state === 'poweredOn') {
                this.emit('ready');
            } else {
                if (this.scanning) {
                    noble.stopScanning();
                    this.scanning = false;
                }
            }
        });

        // Auto-connect in background if a saved device ID is provided
        if (savedDeviceId) {
            logger(`Starting background connection to saved HRM device: ${savedDeviceId}`);

            const maxAttempts = 30;
            let attempts = 0;

            const tryConnectToSavedDevice = () => {
                if (attempts >= maxAttempts) {
                    logger('Max background connection attempts reached for HRM device');
                    return;
                }

                attempts++;
                this.connect(savedDeviceId, 30000) // 30 seconds timeout
                    .then(() => {
                        logger('Successfully connected to saved HRM device in background');
                    })
                    .catch(err => {
                        logger(`Background connection attempt ${attempts} to HRM failed: ${err.message}`);
                        setTimeout(tryConnectToSavedDevice, 0);
                    });
            }

            // wait 1 second before first attempt
            setTimeout(tryConnectToSavedDevice, 1000);
        }
    }

    public async discover(): Promise<Array<{ id: string; name: string | undefined }>> {
        return new Promise((resolve) => {
            const devices: Array<{ id: string; name: string | undefined }> = [];
            const discoveryHandler = (peripheral: Peripheral) => {
                const name = peripheral.advertisement.localName;
                const hasHeartRateService = peripheral.advertisement.serviceUuids?.includes(HEART_RATE_SERVICE_UUID);

                if (!devices.find(d => d.id === peripheral.id)) {
                    devices.push({ id: peripheral.id, name });
                }

                logger(`Discovered device: ${name} - HR Service: ${hasHeartRateService}`);
            };

            noble.on('discover', discoveryHandler);
            noble.startScanning([HEART_RATE_SERVICE_UUID], false);

            setTimeout(() => {
                noble.removeListener('discover', discoveryHandler);
                noble.stopScanning();
                resolve(devices);
            }, 10000);
        });
    }

    public async connect(deviceId?: string, timeout = 30000): Promise<void> {
        if (deviceId == null) {
            return;
        }

        if (this.connected) {
            logger('Already connected to heart rate monitor');
            return;
        }

        return new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                reject(new Error('Heart rate monitor connection timeout'));
            }, timeout);

            logger(`Connecting directly to device: ${deviceId}`);

            const connectDevice = async () => {
                try {
                    // Direct connection without scanning
                    const peripheral = await noble.connectAsync(deviceId);

                    clearTimeout(timeoutHandle);

                    await this.connectToPeripheral(peripheral);
                    resolve();
                } catch (err) {
                    clearTimeout(timeoutHandle);
                    reject(err);
                }
            };

            // Wait for noble to be ready, then connect directly
            if (noble.state === 'poweredOn') {
                connectDevice();
            } else {
                noble.once('stateChange', (state) => {
                    if (state === 'poweredOn') {
                        connectDevice();
                    }
                });
            }
        });
    }

    private async connectToPeripheral(peripheral: Peripheral): Promise<void> {
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
        logger('Connected! Discovering services...');

        // Discover services
        const services = await peripheral.discoverServicesAsync([HEART_RATE_SERVICE_UUID]);
        const hrService = services[0];
        if (!hrService) {
            throw new Error('Heart rate service not found');
        }

        logger('Discovering characteristics...');

        // Discover characteristics
        const characteristics = await hrService.discoverCharacteristicsAsync([HEART_RATE_MEASUREMENT_UUID]);
        this.characteristic = characteristics[0];
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

        this.connected = true;
        logger('Successfully subscribed to heart rate data');
        this.emit('connected');
    }

    public async disconnect(): Promise<void> {
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

        // logger(`Heart Rate: ${heartRate} bpm`);

        // Publish to subject
        this.heartRate$.next({ time: Date.now(), heartRate });

        // Also emit as event for backward compatibility
        this.emit('heartrate', heartRate);
    }

    public getDeviceName(): string {
        return this.peripheral?.advertisement.localName ?? 'Unknown Device';
    }
}
