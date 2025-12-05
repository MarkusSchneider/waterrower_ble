import debug from 'debug';
import { EventEmitter } from 'events';
import { Subscription } from 'rxjs';

import { HeartRateMonitor } from '../ble/heart-rate-monitor';
import { DataPoint } from '../waterrower-serial/data-point';
import { WaterRower } from '../waterrower-serial/waterrower-serial';

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

    private dataPoints: TrainingDataPoint[] = [];
    private waterRowerSubscription?: Subscription;
    private heartRateSubscription?: Subscription;

    private currentData: Partial<TrainingDataPoint> = {}; constructor(
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
        this.dataPoints = [];
        this.currentData = {};

        // Reset WaterRower
        this.waterRower.
            this.waterRower.reset();

        // Subscribe to WaterRower data
        this.waterRowerSubscription = this.waterRower.datapoints$.subscribe({
            next: (dataPoint: DataPoint | null) => {
                if (!dataPoint || this.state !== SessionState.ACTIVE) return;
                this.processWaterRowerData(dataPoint);
            },
            error: (err) => {
                logger('WaterRower error:', err);
                this.emit('error', err);
            }
        });

        // Subscribe to heart rate if monitor is available and connected
        if (this.heartRateMonitor.isConnected()) {
            this.heartRateSubscription = this.heartRateMonitor.heartRate$.subscribe({
                next: (data) => {
                    if (this.state === SessionState.ACTIVE) {
                        this.currentData.heartRate = data.heartRate;
                    }
                },
                error: (err) => {
                    logger('Heart rate monitor error:', err);
                }
            });
        } else if (this.heartRateMonitor) {
            logger('Heart rate monitor configured but not connected. Continuing without HRM data.');
        }

        // Start periodic data collection (every second)
        this.scheduleDataCollection();

        this.emit('started', { sessionId: this.sessionId, startTime: this.startTime });
    }

    public pause(): void {
        if (this.state !== SessionState.ACTIVE) {
            throw new Error(`Cannot pause session in ${this.state} state`);
        }

        logger('Pausing training session');
        this.state = SessionState.PAUSED;
        this.pauseTime = new Date();
        this.emit('paused');
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
        this.scheduleDataCollection();
        this.emit('resumed');
    }

    public stop(): TrainingDataPoint[] {
        if (this.state === SessionState.IDLE || this.state === SessionState.FINISHED) {
            throw new Error(`Cannot stop session in ${this.state} state`);
        }

        logger('Stopping training session');
        this.state = SessionState.FINISHED;
        this.endTime = new Date();

        // Cleanup subscriptions
        this.waterRowerSubscription?.unsubscribe();
        this.heartRateSubscription?.unsubscribe();
        this.heartRateMonitor?.disconnect(); this.emit('stopped', this.getSummary());

        return this.dataPoints;
    }

    public getDataPoints(): TrainingDataPoint[] {
        return [...this.dataPoints];
    }

    public getSummary(): SessionSummary {
        const duration = this.calculateDuration();
        const lastPoint = this.dataPoints[this.dataPoints.length - 1];

        const heartRates = this.dataPoints.map(dp => dp.heartRate).filter(hr => hr !== undefined) as number[];
        const powers = this.dataPoints.map(dp => dp.power).filter(p => p !== undefined) as number[];

        return {
            id: this.sessionId,
            startTime: this.startTime!,
            endTime: this.endTime,
            state: this.state,
            duration,
            distance: lastPoint?.distance ?? 0,
            avgHeartRate: heartRates.length > 0 ? heartRates.reduce((a, b) => a + b, 0) / heartRates.length : undefined,
            maxHeartRate: heartRates.length > 0 ? Math.max(...heartRates) : undefined,
            avgPower: powers.length > 0 ? powers.reduce((a, b) => a + b, 0) / powers.length : undefined,
            maxPower: powers.length > 0 ? Math.max(...powers) : undefined,
            totalCalories: lastPoint?.calories,
            totalStrokes: lastPoint?.totalStrokes,
            dataPoints: this.dataPoints.length
        };
    }

    private processWaterRowerData(dataPoint: DataPoint): void {
        // Update current data based on the data point received
        switch (dataPoint.name) {
            case 'stroke_rate':
                this.currentData.strokeRate = parseInt(dataPoint.value, 16);
                break;
            case 'kcal_watts':
                this.currentData.power = parseInt(dataPoint.value, 16);
                break;
            case 'm_s_total':
                this.currentData.distance = parseInt(dataPoint.value, 16);
                break;
            case 'total_kcal':
                this.currentData.calories = parseInt(dataPoint.value, 16) / 10; // WaterRower reports in tenths
                break;
            case 'strokes_cnt':
                this.currentData.totalStrokes = parseInt(dataPoint.value, 16);
                break;
            case 'ms_average':
                this.currentData.speed = parseInt(dataPoint.value, 16) / 100; // WaterRower reports in cm/s
                break;
        }
    }

    private scheduleDataCollection(): void {
        if (this.state !== SessionState.ACTIVE) return;

        setTimeout(() => {
            this.collectDataPoint();
            this.scheduleDataCollection();
        }, 1000); // Collect data every second
    }

    private collectDataPoint(): void {
        if (this.state !== SessionState.ACTIVE || !this.startTime) return;

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

        this.dataPoints.push(dataPoint);
        this.emit('datapoint', dataPoint);
    }

    private calculateDuration(): number {
        if (!this.startTime) return 0;

        const endTime = this.endTime ?? new Date();
        const elapsed = endTime.getTime() - this.startTime.getTime() - this.totalPausedTime;

        return Math.floor(elapsed / 1000); // Return seconds
    }
}
