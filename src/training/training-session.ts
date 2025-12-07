import debug from 'debug';
import { EventEmitter } from 'events';
import { interval, Subscription, merge, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

import { HeartRateMonitor } from '../ble/heart-rate-monitor';
import { DataPoint } from '../waterrower-serial/data-point';
import { WaterRower } from '../waterrower-serial/waterrower-serial';
import { TrainingSessionEvents } from './training-session-events';

const logger = debug('TRAINING_SESSION');

export interface TrainingDataPoint {
    timestamp: Date;
    elapsedTime: number; // seconds since start
    distance?: number; // meters
    strokeRate?: number; // strokes per minute
    power?: number; // watts
    calories?: number;
    heartRate?: number; // bpm
    speed?: number; // m/s
    totalStrokes?: number;
}

export enum SessionState {
    IDLE = 'idle',
    ACTIVE = 'active',
    PAUSED = 'paused',
    FINISHED = 'finished'
}

export interface SessionSummary {
    id: string;
    startTime: Date;
    endTime?: Date;
    state: SessionState;
    duration: number; // seconds
    distance: number; // meters
    avgHeartRate?: number;
    maxHeartRate?: number;
    avgPower?: number;
    maxPower?: number;
    totalCalories?: number;
    totalStrokes?: number;
    dataPoints: number; // count
}

export class TrainingSession extends EventEmitter {
    private state: SessionState = SessionState.IDLE;
    private sessionId: string;
    private startTime?: Date;
    private endTime?: Date;
    private pauseTime?: Date;
    private totalPausedTime = 0; // milliseconds

    private sessionData: TrainingDataPoint[] = [];
    private subscriptions: Subscription[] = [];
    private currentData: Partial<TrainingDataPoint> = {};

    constructor(
        private waterRower: WaterRower,
        private heartRateMonitor: HeartRateMonitor
    ) {
        super();
        this.sessionId = `session_${Date.now()}`;
    }

    public getSessionId(): string {
        return this.sessionId;
    }

    public getState(): SessionState {
        return this.state;
    }

    public async start(): Promise<void> {
        if (this.state !== SessionState.IDLE) {
            throw new Error(`Cannot start session in ${this.state} state`);
        }

        // Check if WaterRower is connected (required)
        if (!this.waterRower.isConnected()) {
            throw new Error('WaterRower is not connected. Please connect the WaterRower before starting a training session.');
        }

        logger('Starting training session');
        this.state = SessionState.ACTIVE;
        this.startTime = new Date();
        this.sessionData = [];

        // Reset WaterRower
        this.waterRower.reset();

        const observables$: Observable<unknown>[] = [];
        observables$.push(
            this.waterRower.datapoints$.pipe(
                filter(() => this.state === SessionState.ACTIVE),
                map((dataPoint) => {
                    if (!dataPoint) {
                        return;
                    }

                    switch (dataPoint.name) {
                        case 'stroke_rate':
                            this.currentData.strokeRate = dataPoint.value;
                            break;
                        case 'distance':
                            const distance = dataPoint.value;
                            const currentDistance = this.currentData.distance ?? 0;
                            this.currentData.distance = distance > currentDistance ? distance : currentDistance;
                            break;
                        case 'total_kcal':
                            const cal = dataPoint.value / 1000;
                            const currentCal = this.currentData.calories ?? 0;
                            this.currentData.calories = currentCal > cal ? currentCal : cal;
                            break;
                        case 'strokes_cnt':
                            this.currentData.totalStrokes = dataPoint.value;
                            break;
                        case 'm_s_total':
                            const speedCmPerSec = dataPoint.value;
                            this.currentData.speed = speedCmPerSec / 100; // Convert cm/s to m/s
                            // Calculate power using rowing formula: Power (watts) = 2.8 × speed³
                            if (this.currentData.speed > 0) {
                                this.currentData.power = 2.8 * Math.pow(this.currentData.speed, 3);
                            }
                            break;
                    }
                })
            )
        );

        if (this.heartRateMonitor.isConnected()) {
            observables$.push(
                this.heartRateMonitor.heartRate$.pipe(
                    filter(() => this.state === SessionState.ACTIVE),
                    map((data) => {
                        this.currentData.heartRate = data.heartRate;
                    })
                )
            );
        }
        this.subscriptions.push(merge(...observables$).subscribe());

        // Emit datapoints every second
        const intervalSubscription = interval(1000)
            .subscribe({
                next: (elapsedSeconds) => {
                    if (this.state === SessionState.ACTIVE) {
                        this.collectDataPoint(elapsedSeconds % 60 === 0);
                    }
                },
                error: (err) => {
                    logger('Collection interval error:', err);
                    this.emit(TrainingSessionEvents.ERROR, err);
                }
            });

        this.subscriptions.push(intervalSubscription);

        this.emit(TrainingSessionEvents.STARTED, { sessionId: this.sessionId, startTime: this.startTime });

        // enable to replay recorded session
        // setTimeout(() => {
        //     void this.waterRower.playRecording('recording.txt');
        // }, 100);
    }

    public pause(): void {
        if (this.state !== SessionState.ACTIVE) {
            throw new Error(`Cannot pause session in ${this.state} state`);
        }

        logger('Pausing training session');
        this.state = SessionState.PAUSED;
        this.pauseTime = new Date();
        this.emit(TrainingSessionEvents.PAUSED);
    }

    public resume(): void {
        if (this.state !== SessionState.PAUSED) {
            throw new Error(`Cannot resume session in ${this.state} state`);
        }

        logger('Resuming training session');
        if (this.pauseTime) {
            this.totalPausedTime += Date.now() - this.pauseTime.getTime();
        }
        this.state = SessionState.ACTIVE;
        this.emit(TrainingSessionEvents.RESUMED);
    }

    public stop(): TrainingDataPoint[] {
        if (this.state === SessionState.IDLE || this.state === SessionState.FINISHED) {
            throw new Error(`Cannot stop session in ${this.state} state`);
        }

        logger('Stopping training session');

        this.state = SessionState.FINISHED;
        this.endTime = new Date();

        // Cleanup all subscriptions
        this.subscriptions.forEach(sub => sub.unsubscribe());
        this.subscriptions = [];

        this.waterRower.close();
        this.heartRateMonitor.disconnectAsync();

        this.collectDataPoint(true);
        this.emit(TrainingSessionEvents.STOPPED, this.getSummary());

        return this.sessionData;
    }

    public getSummary(): SessionSummary {
        const duration = this.calculateDuration();
        const lastPoint = this.sessionData[this.sessionData.length - 1];

        const heartRates = this.sessionData.map(dp => dp.heartRate).filter(hr => hr !== undefined) as number[];
        const powers = this.sessionData.map(dp => dp.power).filter(p => p !== undefined) as number[];

        return {
            id: this.sessionId,
            startTime: this.startTime!,
            endTime: this.endTime,
            state: this.state,
            duration,
            distance: (lastPoint?.distance ?? 0) / 1000,
            avgHeartRate: heartRates.length > 0 ? heartRates.reduce((a, b) => a + b, 0) / heartRates.length : undefined,
            maxHeartRate: heartRates.length > 0 ? Math.max(...heartRates) : undefined,
            avgPower: powers.length > 0 ? powers.reduce((a, b) => a + b, 0) / powers.length : undefined,
            maxPower: powers.length > 0 ? Math.max(...powers) : undefined,
            totalCalories: lastPoint?.calories,
            totalStrokes: lastPoint?.totalStrokes,
            dataPoints: this.sessionData.length
        };
    }

    private collectDataPoint(pushToSessionData: boolean): void {
        if (this.state !== SessionState.ACTIVE) {
            return;
        }

        const elapsedTime = this.calculateDuration();

        const dataPoint: TrainingDataPoint = {
            timestamp: new Date(),
            elapsedTime,
            distance: this.currentData.distance,
            strokeRate: this.currentData.strokeRate,
            power: this.currentData.power,
            calories: this.currentData.calories,
            heartRate: this.currentData.heartRate,
            speed: this.currentData.speed,
            totalStrokes: this.currentData.totalStrokes
        };
        this.emit(TrainingSessionEvents.DATAPOINT, dataPoint);

        if (!pushToSessionData) {
            return;
        }

        this.sessionData.push(dataPoint);
    }

    private calculateDuration(): number {
        if (!this.startTime) return 0;

        const endTime = this.endTime ?? new Date();
        const elapsed = endTime.getTime() - this.startTime.getTime() - this.totalPausedTime;

        return Math.floor(elapsed / 1000); // Return seconds
    }
}
