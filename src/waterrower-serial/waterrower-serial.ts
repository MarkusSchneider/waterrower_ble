import { Observable, Subject, Subscription, concatMap, delay, filter, from, lastValueFrom, map, of, tap, zip } from 'rxjs';
import { SerialPort } from 'serialport';
import { EventEmitter } from 'events';
import * as path from 'path';

import { appendFileSync, existsSync, fstat, readFileSync, readdirSync, unlinkSync } from 'fs';
import { AverageIntensityDisplayOptions, DisplaySetIntensity, Units } from './enums';
import { DEFAULT_WATER_ROWER_OPTIONS, WaterRowerOptions } from './water-rower-options';
import { ReadValue } from './read-value';
import { DataPoint } from './data-point';
import { FrameTypes } from './frame-types';
import { DataPoints } from './datapoints-config';
import debug from 'debug';

const logger = debug('WR_SERIAL');

export class WaterRower extends EventEmitter {

    private recordingSubscription: Subscription | null = null;
    private options: WaterRowerOptions = DEFAULT_WATER_ROWER_OPTIONS;
    private serialPort: SerialPort | null = null;
    private requestTime: NodeJS.Timeout | null = null;

    // reads$ is all serial messages from the WR
    public reads$ = new Subject<ReadValue>();
    // datapoints$ isonly the reads that are a report of a memory location's value 
    public datapoints$: Observable<DataPoint | null> = of();

    constructor(optionsFn: (o: WaterRowerOptions) => void) {
        super();
        optionsFn(this.options);

        this.setupStreams();

        process.on('SIGINT', () => {
            this.close();
        });
    }

    public connectSerial(): void {
        if (this.options.portName?.length === 0) {
            logger('No port configured. Attempting to discover...');

            this.discoverPort(name => {
                if (name) {
                    logger(`Discovered a WaterRower on ${name} ...`);
                    this.options.portName = name;
                    this.setupSerialPort(this.options);
                } else {
                    logger('We didn\'t find any connected WaterRowers');
                }
            });
        } else {
            logger(`Setting up serial port on ${this.options.portName} ...`);
            this.setupSerialPort(this.options);
        }
    }

    public isConnected(): boolean {
        return this.serialPort != null && this.serialPort.isOpen;
    }

    public getPortName(): string | undefined {
        return this.options.portName;
    }

    private discoverPort(callback: (name?: string) => void): void {
        SerialPort.list().then((ports) => {
            const p = ports.find(
                p => [
                    'Microchip Technology, Inc.', // standard
                    'Microchip Technology Inc.', // macOS specific?
                ].includes(p.manufacturer ?? '')
            );

            if (p) {
                callback(p.path);
            } else {
                callback();
            }
        });
    }

    private setupSerialPort(options: WaterRowerOptions): void {
        this.serialPort = new SerialPort({
            path: options.portName ?? '',
            baudRate: options.baudRate ?? this.options.baudRate,
        });

        // setup port events
        this.serialPort.on('open', () => {
            logger(`A connection to the WaterRower has been established on ${options.portName}`);
            this.initialize();
            if (options.refreshRate !== 0) {
                this.requestTime = setInterval(() => this.requestDataPoints(this.options.datapoints), this.options.refreshRate);
            }
        });
        this.serialPort.on('data', (data: string) => {
            const type = FrameTypes.find(t => t.pattern.test(data));
            this.reads$.next({ time: Date.now(), type: (type?.type ?? 'other'), data: data.toString() });
        });
        this.serialPort.on('closed', () => this.close);
        this.serialPort.on('disconnect', () => this.close);
        this.serialPort.on('error', err => {
            this.emit('error', err);
            this.close();
        });
    }

    public setupStreams(): void {
        // this is the important stream for reading memory locations from the rower
        // IDS is a single, IDD is a double, and IDT is a triple byte memory location
        this.datapoints$ = this.reads$.pipe(
            filter(data => data.type === 'datapoint'),
            map(data => {
                const pattern = FrameTypes.find(t => t.type == 'datapoint')?.pattern;
                if (pattern == null) {
                    return null;
                }

                const m = pattern.exec(data.data);
                if (m == null || m.length == 0) {
                    logger(`parsing error: ${data.data}`);
                    return null;
                }
                const dataPointDefinition = DataPoints.find(point => point.address == m[2]);
                if (dataPointDefinition == null) {
                    logger(`unknown datapoint address: ${m[2]}`);
                    return null;
                }

                const dataPoint: DataPoint =
                {
                    time: new Date(data.time),
                    name: dataPointDefinition.name,
                    length: { 'S': 1, 'D': 2, 'T': 3 }[m[1]] ?? 0,
                    address: m[2],
                    value: parseInt(m[3], dataPointDefinition.radix),
                };

                return dataPoint;
            }));

        // //emit the data event
        // this.datapoints$.subscribe(d => {
        //     if (d == null) {
        //         return;
        //     }

        //     const datapoint = DataPoints.find(d2 => d2.address == d.address);
        //     if (datapoint == null) {
        //         return;
        //     }

        //     datapoint.value = parseInt(d.value, datapoint.radix);
        //     this.emit('data', datapoint);
        // });

        // when the WR comes back with _WR_ then consider the WR initialized
        this.reads$
            .pipe(
                filter(d => d.type == 'hardwaretype')
            )
            .subscribe(() => {
                this.emit('initialized');
            });
    }

    /// send a serial message
    private send(value: string): void {
        if (this.serialPort != null) {
            this.serialPort.write(value + '\r\n');
        }
    }

    /// initialize the connection    
    private initialize(): void {
        logger('Initializing port...');
        this.send('USB');
    }

    public close(): void {
        logger('Closing WaterRower...');
        this.send('EXIT');
        this.emit('close');
        this.reads$.complete();
        if (this.serialPort) {
            this.serialPort.close(err => logger(err));
            this.serialPort = null;
        }

        if (this.requestTime) {
            clearInterval(this.requestTime);
            this.requestTime = null;
        }
    }

    /// reset console
    reset(): void {
        logger('Resetting WaterRower...');
        this.send('RESET'); //reset the waterrower 
        this.initialize();
    }

    /// Issues a request for one, more, or all data points.
    /// There is no return value. Data point values can be read very
    /// shortly after the request is made 
    requestDataPoints(points?: string | Array<string>): void {
        const delayMs = 50;

        const reqValue = (name: string): void => {
            logger('requesting ' + name);
            const dataPoint = DataPoints.find(d => d.name == name);
            if (dataPoint == null) {
                return;
            }
            this.send(`IR${dataPoint.length}${dataPoint.address}`);
        };

        if (points) {
            if (Array.isArray(points)) {
                points.forEach((p, i) => setTimeout(() => reqValue(p), delayMs * i));
            } else if (typeof points === 'string') {
                reqValue(points);
            } else {
                throw ('requestDataPoint requires a string, an array of strings, or nothing at all');
            }
        } else {
            DataPoints.forEach((d, i) => setTimeout(() => reqValue(d.name), delayMs * i));
        }
    }

    readDataPoints(points?: string | Array<string>): Record<string, number> | number {
        if (points) {
            if (Array.isArray(points)) {
                return DataPoints
                    .filter(dp => points.some(p => p == dp.name)) //filter to the points that were passed in
                    .reduce((p, c) => {
                        p[c.name] = c.value;
                        return p;
                    }, {} as Record<string, number>); //build up an array of the chosen points
            } else if (typeof points === 'string') {
                return DataPoints.find(d => d.name == points)?.value ?? 0;
            } else {
                throw ('readDataPoints requires a string, an array of strings, or nothing at all');
            }
        } else {
            return DataPoints
                .reduce((p, c) => {
                    p[c.name] = c.value;
                    return p;
                }, {} as Record<string, number>);
        }
    }

    startRecording(name?: string): void {
        const now = new Date();
        const fileName = name ?? `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;

        const filePath = path.join(this.options.dataDirectory, fileName);
        if (existsSync(filePath)) {
            unlinkSync(filePath)
        }

        this.recordingSubscription = this.reads$
            .pipe(
                filter(r => r.type != 'pulse'), //pulses are noisy
                map(r => JSON.stringify(r)),
                tap(json => logger(`save recording ${json}`)),
                tap(json => appendFileSync(filePath, json + '\n'))
            ).subscribe();

    }

    stopRecording(): void {
        this.recordingSubscription?.unsubscribe();
    }

    getRecordings(): Array<string> {
        return readdirSync(this.options.dataDirectory);
    }

    playRecording(name?: string): Promise<void> {
        name = name ?? 'simulationdata';
        const lines = readFileSync(path.join(this.options.dataDirectory, name), 'utf-8').split(/\r?\n/)
            .filter(value => value?.length > 0)
            .map(value => JSON.parse(value) as ReadValue);

        const timeSpans: Array<number> = [];
        lines.map(value => value.time)
            .reduce((acc, value) => {
                const delta = value - acc;
                timeSpans.push(delta);
                return value;
            }, lines[0].time);

        const replay$ = zip(from(timeSpans), from(lines))
            .pipe(
                concatMap(value => of(value).pipe(delay(value[0]))),
                tap(value => this.reads$.next(value[1])),
                map(() => void 0)
            );

        return lastValueFrom(replay$);
    }

    /// set up new workout session on the WR with set distance
    defineDistanceWorkout(distance: number, units: Units = Units.Meters): void {
        this.send(`WSI${units}${distance.toString(16).padStart(4, '0').toUpperCase()}`);
    }

    /// set up new workout session on the WR with set duration
    defineDurationWorkout(seconds: number): void {
        this.send(`WSU${seconds.toString(16).padStart(4, '0').toUpperCase()}`);
    }

    /// change the display to meters, miles, kilometers, or strokes
    displaySetDistance(units: Units): void {
        let value = 'DD';
        switch (units) {
            case Units.Meters: value += 'ME'; break;
            case Units.Miles: value += 'MI'; break;
            case Units.Kilometers: value += 'KM'; break;
            case Units.Strokes: value += 'ST'; break;
            default: throw 'units must be meters, miles, kilometers, or strokes';
        }
        this.send(value);
    }

    /// change the intensity display
    displaySetIntensity(option: DisplaySetIntensity): void {
        let value = 'DD';
        switch (option) {
            case DisplaySetIntensity.MetersPerSecond: value += 'MS'; break;
            case DisplaySetIntensity.MPH: value += 'MPH'; break;
            case DisplaySetIntensity._500m: value += '500'; break;
            case DisplaySetIntensity._2km: value += '2KM'; break;
            case DisplaySetIntensity.Watts: value += 'WA'; break;
            case DisplaySetIntensity.CaloriesPerHour: value += 'CH'; break;
        }
        this.send(value);
    }

    /// change the average intensity display
    displaySetAverageIntensity(option: AverageIntensityDisplayOptions): void {
        let value = 'DD';
        switch (option) {
            case AverageIntensityDisplayOptions.AverageMetersPerSecond: value += 'MS'; break;
            case AverageIntensityDisplayOptions.AverageMPH: value += 'MPH'; break;
            case AverageIntensityDisplayOptions._500m: value += '500'; break;
            case AverageIntensityDisplayOptions._2km: value += '2KM'; break;
            default: throw 'units must be meters, miles, kilometers, or strokes';
        }
        this.send(value);
    }
}
