// import * as SerialPort from 'serialport';
import { Observable, Subject, Subscription, filter, from, map, of, tap } from 'rxjs';
import { SerialPort } from 'serialport';
import * as events from 'events';
import * as path from 'path';

import { appendFileSync, readFileSync, readdirSync } from 'fs';
import { AverageIntensityDisplayOptions, DisplaySetIntensity, Units } from './enums';
import { WaterRowerOptions } from './water-rower-options.js';
import { ReadValue } from './read-value';
import { DataPoint } from './data-point';
import { FrameTypes } from './frame-types';
import { DataPoints } from './datapoints-config';

export class WaterRower extends events.EventEmitter {
    private refreshRate: number = 200;
    private baudRate: number = 19200;
    private port: SerialPort | null = null;
    private dataDirectory: string = 'data';
    private datapoints: string | Array<string>;
    private recordingSubscription: Subscription | null = null;

    // reads$ is all serial messages from the WR
    // datapoints$ isonly the reads that are a report of a memory location's value 
    public reads$ = new Subject<ReadValue>();
    public datapoints$: Observable<DataPoint | null> = of();

    constructor(options: WaterRowerOptions = {}) {
        super();

        this.dataDirectory = options.dataDirectory || this.dataDirectory;
        this.refreshRate = options.refreshRate || this.refreshRate;
        this.baudRate = options.baudRate || this.baudRate;
        this.datapoints = options.datapoints ?? [];

        if (!options.portName) {
            console.log('No port configured. Attempting to discover...');

            this.discoverPort(name => {
                if (name) {
                    console.log('Discovered a WaterRower on ' + name + '...');
                    options.portName = name;
                    this.setupSerialPort(options);
                } else
                    console.log('We didn\'t find any connected WaterRowers');
            });
        } else {
            console.log('Setting up serial port on ' + options.portName + '...');
            this.setupSerialPort(options);
        }

        this.setupStreams();

        process.on('SIGINT', () => {
            this.close();
        });

    }

    private discoverPort(callback: (name?: string) => void) {
        // SerialPort.list((err, ports) => {
        //     const p = find(ports, p => includes([
        //         'Microchip Technology, Inc.', // standard
        //         'Microchip Technology Inc.' // macOS specific?
        //     ], p.manufacturer));

        //     if (p) {
        //         callback(p.comName);
        //     }
        //     else {
        //         callback();
        //     }
        // });
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

    private setupSerialPort(options: WaterRowerOptions) {
        // setup the serial port
        // this.port = new SerialPort(options.portName, {
        //     baudRate: options.baudRate || this.baudRate
        // });
        this.port = new SerialPort({
            path: options.portName ?? '',
            baudRate: options.baudRate || this.baudRate,
        });

        // setup port events
        this.port.on('open', () => {
            console.log(`A connection to the WaterRower has been established on ${options.portName}`);
            this.initialize();
            if (options.refreshRate !== 0) setInterval(() => this.requestDataPoints(this.datapoints), this.refreshRate);
        });
        this.port.on('data', d => {
            const type = FrameTypes.find(t => t.pattern.test(d));
            this.reads$.next({ time: Date.now(), type: (type ? type.type : 'other'), data: d });
        });
        this.port.on('closed', () => this.close);
        this.port.on('disconnect', () => this.close);
        this.port.on('error', err => {
            this.emit('error', err);
            this.close();
        });
    }

    public setupStreams() {
        // this is the important stream for reading memory locations from the rower
        // IDS is a single, IDD is a double, and IDT is a triple byte memory location
        this.datapoints$ = this.reads$.pipe(
            filter(d => d.type === 'datapoint'),
            map(d => {
                const pattern = FrameTypes.find(t => t.type == 'datapoint')?.pattern;
                if (pattern == null) {
                    return null;
                }

                const m = pattern.exec(d.data);
                if (m == null) {
                    return null;
                }

                const dataPoint: DataPoint =
                {
                    time: new Date(d.time),
                    name: DataPoints.find(point => point.address == m[2])?.name,
                    length: { 'S': 1, 'D': 2, 'T': 3 }[m[1]] ?? 0,
                    address: m[2],
                    value: m[3],
                };

                return dataPoint;
            }));

        //emit the data event
        this.datapoints$.subscribe(d => {
            if (d == null) {
                return;
            }

            const datapoint = DataPoints.find(d2 => d2.address == d.address);
            if (datapoint == null) {
                return;
            }

            datapoint.value = parseInt(d.value, datapoint.radix);
            this.emit('data', datapoint);
        });

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
        if (this.port) {
            this.port.write(value + '\r\n');
        }
    }

    /// initialize the connection    
    private initialize(): void {
        console.log('Initializing port...');
        this.send('USB');
    }

    private close(): void {
        console.log('Closing WaterRower...');
        this.emit('close');
        this.reads$.complete();
        if (this.port) {
            this.port.close(err => console.log(err));
            this.port = null;
        }
        process.exit();
    }

    /// reset console
    reset(): void {
        console.log('Resetting WaterRower...');
        this.send('RESET'); //reset the waterrower 
    }

    /// Issues a request for one, more, or all data points.
    /// There is no return value. Data point values can be read very
    /// shortly after the request is made 
    requestDataPoints(points?: string | Array<string>): void {
        const req = (name: string): void => {
            console.log('requesting ' + name);
            const dataPoint = DataPoints.find(d => d.name == name);
            if (dataPoint == null) {
                return;
            }
            this.send(`IR${dataPoint.length}${dataPoint.address}`);
        };

        if (points) {
            if (Array.isArray(points)) points.forEach(p => req(p));
            else if (typeof points === 'string') req(points);
            else throw ('requestDataPoint requires a string, an array of strings, or nothing at all');
        } else
            DataPoints.forEach(d => req(d.name));

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

    startRecording(name?: string) {
        const now = new Date();
        const fileName = name ?? `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
        this.recordingSubscription = this.reads$
            .pipe(
                filter(r => r.type != 'pulse'), //pulses are noisy
                tap(r => appendFileSync(path.join(this.dataDirectory, fileName), JSON.stringify(r) + '\n'))
            ).subscribe();

    }

    stopRecording(): void {
        this.recordingSubscription?.unsubscribe();
    }

    getRecordings(): Array<string> {
        return readdirSync(this.dataDirectory);
    }

    playRecording(name?: string): void {
        name = name || 'simulationdata';
        const lines = readFileSync(path.join(this.dataDirectory, name), 'utf-8').split(/\r?\n/);

        const simdata$: Observable<ReadValue> = from(lines)
            .pipe(
                filter(value => (value ? true : false)),
                map(value => JSON.parse(value.toString()))
            );

        let firstrow: ReadValue;
        simdata$.subscribe(row => {
            if (!firstrow) firstrow = row;
            const delta = row.time - firstrow.time;
            setTimeout(() => {
                this.reads$.next({ time: row.time, type: row.type, data: row.data });
            }, delta);
        });
    }

    startSimulation(): void {
        this.playRecording();
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



