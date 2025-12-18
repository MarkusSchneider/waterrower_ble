import debug from 'debug';
import { writeFileSync, readFileSync } from 'fs';
import { Encoder, Stream, Decoder, Profile } from '@garmin/fitsdk';

import {
    SessionSummary,
    TrainingDataPoint,
} from '../training/training-session';
import { ConfigManager } from '../helper/config-manager';
import {
    FitFileType,
    FitManufacturer,
    Concept2Product,
    FitSourceType,
    FitSport,
    FitSubSport,
    FitEvent,
    FitEventType,
    FitLapTrigger,
    FitActivityType,
} from './fit-constants';

const logger = debug('FIT_GENERATOR');

// FIT file constants
const FILE_TYPE = FitFileType.ACTIVITY;
const MANUFACTURER = FitManufacturer.WATERROWER;
const PRODUCT = Concept2Product.PM5;
const SERIAL_NUMBER = 123456; // Default serial number if not provided
const SOURCE_TYPE = FitSourceType.LOCAL;
const SPORT = FitSport.ROWING;
const SUB_SPORT = FitSubSport.INDOOR_ROWING;

export class FitFileGenerator {
    constructor(private configManager: ConfigManager) { }

    /**
     * Generate a FIT file from training session data
     * Using WaterRower manufacturer ID for proper device identification
     * @param summary - Training session summary data
     * @param dataPoints - Array of training data points recorded during session
     * @returns Path to the generated FIT file
     */
    public generateFitFile(
        summary: SessionSummary,
        dataPoints: TrainingDataPoint[],
    ): string {
        logger('Generating FIT file...');

        const encoder = new Encoder();

        // File ID message
        encoder.onMesg(Profile.MesgNum.FILE_ID, {
            type: FILE_TYPE,
            manufacturer: MANUFACTURER,
            product: PRODUCT,
            timeCreated: summary.startTime,
            serialNumber: SERIAL_NUMBER,
        });

        // Device Info message
        encoder.onMesg(Profile.MesgNum.DEVICE_INFO, {
            timestamp: summary.startTime,
            manufacturer: MANUFACTURER,
            product: PRODUCT,
            serialNumber: SERIAL_NUMBER,
            deviceIndex: 0,
            sourceType: SOURCE_TYPE,
        });

        // Sport message
        encoder.onMesg(Profile.MesgNum.SPORT, {
            sport: SPORT,
            subSport: SUB_SPORT,
            name: 'Indoor Rowing',
        });

        // Record messages (data points)
        dataPoints.forEach((point) => {
            const recordMessage: any = {
                timestamp: point.timestamp,
                distance: point.distance ? Math.round(point.distance * 1000) : undefined, // scaled to 1/100 m (cm)
                cadence: point.strokeRate, // Stroke rate as cadence
            };

            if (point.heartRate) {
                recordMessage.heartRate = Math.round(point.heartRate);
            }
            if (point.power) {
                recordMessage.power = Math.round(point.power);
            }
            if (point.speed) {
                recordMessage.speed = Math.round(point.speed * 1000); // m/s to scaled (1/1000 m/s = mm/s)
            }
            if (point.calories) {
                recordMessage.calories = Math.round(point.calories);
            }

            encoder.onMesg(Profile.MesgNum.RECORD, recordMessage);
        });

        // Create 500m laps with calculated values
        const laps = this.createLapsFromDataPoints(dataPoints, 500);
        logger(`Generated ${laps.length} laps (500m intervals)`);

        laps.forEach((lap) => {
            encoder.onMesg(Profile.MesgNum.LAP, {
                timestamp: lap.endTime,
                startTime: lap.startTime,
                totalElapsedTime: lap.duration,
                totalTimerTime: lap.duration,
                totalDistance: Math.round(lap.distance * 1000), // scale 100: meters to 1/100 m (cm)
                totalCalories: lap.calories ? Math.round(lap.calories) : undefined,
                avgHeartRate: lap.avgHeartRate ? Math.round(lap.avgHeartRate) : undefined,
                maxHeartRate: lap.maxHeartRate ? Math.round(lap.maxHeartRate) : undefined,
                avgPower: lap.avgPower ? Math.round(lap.avgPower) : undefined,
                maxPower: lap.maxPower ? Math.round(lap.maxPower) : undefined,
                avgSpeed: lap.avgSpeed ? Math.round(lap.avgSpeed * 1000) : undefined, // scale 1000: m/s to 1/1000 m/s (mm/s)
                maxSpeed: lap.maxSpeed ? Math.round(lap.maxSpeed * 1000) : undefined, // scale 1000: m/s to 1/1000 m/s (mm/s)
                totalStrokes: lap.totalStrokes,
                sport: SPORT,
                subSport: SUB_SPORT,
                lapTrigger: FitLapTrigger.DISTANCE,
                event: FitEvent.LAP,
                eventType: FitEventType.STOP,
            });
        });

        // Session message
        encoder.onMesg(Profile.MesgNum.SESSION, {
            timestamp: summary.endTime ?? summary.startTime,
            startTime: summary.startTime,
            totalElapsedTime: summary.duration,
            totalTimerTime: summary.duration,
            totalDistance: Math.round(summary.distance * 1000), // scale 100: meters to 1/100 m (cm)
            totalCalories: Math.round(summary.totalCalories ?? 0),
            avgHeartRate: summary.avgHeartRate ? Math.round(summary.avgHeartRate) : undefined,
            maxHeartRate: summary.maxHeartRate ? Math.round(summary.maxHeartRate) : undefined,
            avgPower: summary.avgPower ? Math.round(summary.avgPower) : undefined,
            maxPower: summary.maxPower ? Math.round(summary.maxPower) : undefined,
            avgSpeed: summary.avgSpeed ? Math.round(summary.avgSpeed * 1000) : undefined, // scale 1000: m/s to 1/1000 m/s (mm/s)
            maxSpeed: summary.maxSpeed ? Math.round(summary.maxSpeed * 1000) : undefined, // scale 1000: m/s to 1/1000 m/s (mm/s)
            totalStrokes: summary.totalStrokes,
            sport: SPORT,
            subSport: SUB_SPORT,
            firstLapIndex: 0,
            numLaps: laps.length,
            event: FitEvent.SESSION,
            eventType: FitEventType.STOP,
            trigger: FitLapTrigger.MANUAL,
        });

        // Activity message
        encoder.onMesg(Profile.MesgNum.ACTIVITY, {
            timestamp: summary.endTime ?? summary.startTime,
            totalTimerTime: summary.duration,
            numSessions: 1,
            type: FitActivityType.MANUAL,
            event: FitEvent.ACTIVITY,
            eventType: FitEventType.STOP,
        });

        // Close encoder and get bytes
        const uint8Array = encoder.close();
        const buffer = Buffer.from(uint8Array);

        // Save to file
        const outputPath = this.configManager.getFitFilesDirectory();
        const fileName = `waterrower_${new Date().getTime()}.fit`;
        const fullPath = `${outputPath}/${fileName}`;
        writeFileSync(fullPath, buffer);
        logger(`FIT file saved to: ${fullPath}`);

        return fullPath;
    }

    /**
     * Create laps from data points based on distance intervals
     * @param dataPoints - Array of training data points
     * @param lapDistanceMeters - Distance interval for each lap in meters (e.g., 500)
     * @returns Array of lap statistics
     */
    private createLapsFromDataPoints(
        dataPoints: TrainingDataPoint[],
        lapDistanceMeters: number
    ) {
        const laps: Array<{
            startTime: Date;
            endTime: Date;
            duration: number;
            distance: number;
            calories?: number;
            avgHeartRate?: number;
            maxHeartRate?: number;
            avgPower?: number;
            maxPower?: number;
            avgSpeed?: number;
            maxSpeed?: number;
            totalStrokes?: number;
        }> = [];

        if (dataPoints.length === 0) {
            return laps;
        }

        let lapStartIndex = 0;
        let currentLapThreshold = lapDistanceMeters;

        for (let i = 0; i < dataPoints.length; i++) {
            const point = dataPoints[i];

            // Check if we've crossed the lap distance threshold
            if (point.distance && point.distance >= currentLapThreshold) {
                // Get all points from lap start to current point (inclusive)
                const lapPoints = dataPoints.slice(lapStartIndex, i + 1);
                const lapStats = this.calculateLapStatistics(lapPoints);
                laps.push(lapStats);

                // Prepare for next lap
                lapStartIndex = i + 1;
                currentLapThreshold += lapDistanceMeters;
            }
        }

        // Handle remaining points as final (potentially partial) lap
        if (lapStartIndex < dataPoints.length) {
            const lapPoints = dataPoints.slice(lapStartIndex);
            const lapStats = this.calculateLapStatistics(lapPoints);
            laps.push(lapStats);
        }

        return laps;
    }

    /**
     * Calculate statistics for a lap from its data points
     */
    private calculateLapStatistics(points: TrainingDataPoint[]) {
        if (points.length === 0) {
            throw new Error('Cannot calculate lap statistics from empty points array');
        }

        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];

        // Calculate duration in seconds
        const duration = (lastPoint.timestamp.getTime() - firstPoint.timestamp.getTime()) / 1000;

        // Calculate distance for this lap (difference between first and last point)
        const startDistance = firstPoint.distance || 0;
        const endDistance = lastPoint.distance || 0;
        const lapDistance = endDistance - startDistance;

        // Heart rate statistics
        const hrValues = points.filter(p => p.heartRate && p.heartRate > 0).map(p => p.heartRate!);
        const avgHeartRate = hrValues.length > 0 ? hrValues.reduce((sum, hr) => sum + hr, 0) / hrValues.length : undefined;
        const maxHeartRate = hrValues.length > 0 ? Math.max(...hrValues) : undefined;

        // Power statistics
        const powerValues = points.filter(p => p.power && p.power > 0).map(p => p.power!);
        const avgPower = powerValues.length > 0 ? powerValues.reduce((sum, p) => sum + p, 0) / powerValues.length : undefined;
        const maxPower = powerValues.length > 0 ? Math.max(...powerValues) : undefined;

        // Speed statistics
        const speedValues = points.filter(p => p.speed && p.speed > 0).map(p => p.speed!);
        const avgSpeed = speedValues.length > 0 ? speedValues.reduce((sum, s) => sum + s, 0) / speedValues.length : undefined;
        const maxSpeed = speedValues.length > 0 ? Math.max(...speedValues) : undefined;

        // Calories and strokes (difference between first and last)
        const startCalories = firstPoint.calories || 0;
        const endCalories = lastPoint.calories || 0;
        const lapCalories = endCalories - startCalories;

        const startStrokes = firstPoint.totalStrokes || 0;
        const endStrokes = lastPoint.totalStrokes || 0;
        const lapStrokes = endStrokes - startStrokes;

        return {
            startTime: firstPoint.timestamp,
            endTime: lastPoint.timestamp,
            duration,
            distance: lapDistance,
            calories: lapCalories,
            avgHeartRate,
            maxHeartRate,
            avgPower,
            maxPower,
            avgSpeed,
            maxSpeed,
            totalStrokes: lapStrokes,
        };
    }

    /**
     * Parse a FIT file (utility method for testing/debugging)
     */
    public parseFitFile(filePath: string): Promise<{ messages: any; errors: any; }> {
        return new Promise((resolve, reject) => {
            try {
                const buffer = readFileSync(filePath);
                const stream = Stream.fromBuffer(buffer);
                const decoder = new Decoder(stream);
                const { messages, errors } = decoder.read();

                if (errors.length > 0) {
                    reject(new Error(`Decoding errors: ${errors.join(', ')}`));
                } else {
                    resolve({ messages, errors });
                }
            } catch (error) {
                reject(error);
            }
        });
    }
}
