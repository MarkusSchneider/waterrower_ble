import debug from 'debug';
import { EventEmitter } from 'events';
import { Subject, Observable } from 'rxjs';

import noble from '@abandonware/noble';

const logger = debug('HR_MONITOR');

// Standard Bluetooth Heart Rate Service and Characteristic UUIDs
const HEART_RATE_SERVICE_UUID = '180d';
const HEART_RATE_MEASUREMENT_UUID = '2a37';

export interface HeartRateData {
    time: number;
    heartRate: number;
}

export class HeartRateMonitor extends EventEmitter {
    private peripheral?: noble.Peripheral;
    private characteristic?: noble.Characteristic;
    private connected = false;
    private scanning = false;

    // Subject for publishing heart rate data
    public heartRate$ = new Subject<HeartRateData>();

    constructor() {
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
    }

    public async discover(): Promise<Array<{ id: string; name: string | undefined }>> {
        return new Promise((resolve) => {
            const devices: Array<{ id: string; name: string | undefined }> = [];
            const discoveryHandler = (peripheral: noble.Peripheral) => {
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
                noble.stopScanning();
                this.scanning = false;
                reject(new Error('Heart rate monitor connection timeout'));
            }, timeout);

            logger('Starting scan for heart rate monitors...');

            noble.on('discover', async (peripheral) => {
                const id = peripheral.id;
                const hasHeartRateService = peripheral.advertisement.serviceUuids?.includes(HEART_RATE_SERVICE_UUID);

                const name = peripheral.advertisement.localName;
                logger(`Discovered device: ${name} - HR Service: ${hasHeartRateService}`);

                // Connect if it has heart rate service and matches device ID (if provided) or auto-connect to first device
                if (hasHeartRateService && id === deviceId) {
                    clearTimeout(timeoutHandle);
                    noble.stopScanning();
                    this.scanning = false;

                    try {
                        await this.connectToPeripheral(peripheral);
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                }
            });

            // Wait for noble to be ready, then start scanning
            if ((noble as any).state === 'poweredOn') {
                noble.startScanning([HEART_RATE_SERVICE_UUID], false);
                this.scanning = true;
            } else {
                noble.once('stateChange', (state) => {
                    if (state === 'poweredOn') {
                        noble.startScanning([HEART_RATE_SERVICE_UUID], false);
                        this.scanning = true;
                    }
                });
            }
        });
    }

    private async connectToPeripheral(peripheral: noble.Peripheral): Promise<void> {
        this.peripheral = peripheral;

        logger(`Connecting to ${peripheral.advertisement.localName}...`);

        return new Promise((resolve, reject) => {
            peripheral.connect((error) => {
                if (error) {
                    logger('Connection error:', error);
                    reject(error);
                    return;
                }

                logger('Connected! Discovering services...');

                peripheral.discoverServices([HEART_RATE_SERVICE_UUID], (error, services) => {
                    if (error) {
                        logger('Service discovery error:', error);
                        reject(error);
                        return;
                    }

                    const hrService = services[0];
                    if (!hrService) {
                        reject(new Error('Heart rate service not found'));
                        return;
                    }

                    logger('Discovering characteristics...');

                    hrService.discoverCharacteristics([HEART_RATE_MEASUREMENT_UUID], (error, characteristics) => {
                        if (error) {
                            logger('Characteristic discovery error:', error);
                            reject(error);
                            return;
                        }

                        this.characteristic = characteristics[0];
                        if (!this.characteristic) {
                            reject(new Error('Heart rate measurement characteristic not found'));
                            return;
                        }

                        logger('Subscribing to heart rate notifications...');

                        this.characteristic.subscribe((error) => {
                            if (error) {
                                logger('Subscription error:', error);
                                reject(error);
                                return;
                            }

                            this.characteristic!.on('data', (data) => {
                                this.parseHeartRateData(data);
                            });

                            this.connected = true;
                            logger('Successfully subscribed to heart rate data');
                            this.emit('connected');
                            resolve();
                        });
                    });
                });
            });

            peripheral.once('disconnect', () => {
                logger('Heart rate monitor disconnected');
                this.connected = false;
                this.peripheral = undefined;
                this.characteristic = undefined;
                this.emit('disconnected');
            });
        });
    }

    public disconnect(): void {
        if (this.peripheral && this.connected) {
            logger('Disconnecting from heart rate monitor...');
            this.peripheral.disconnect();
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
