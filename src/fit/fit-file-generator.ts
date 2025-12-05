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
        });

        // Record messages (data points)
        dataPoints.forEach((point) => {
            const recordMessage: any = {
                timestamp: point.timestamp,
                distance: point.distance ? Math.round(point.distance * 100) : undefined, // cm
                cadence: point.strokeRate, // Stroke rate as cadence
            };

            if (point.heartRate) {
                recordMessage.heartRate = Math.round(point.heartRate);
            }
            if (point.power) {
                recordMessage.power = Math.round(point.power);
            }
            if (point.speed) {
                recordMessage.speed = Math.round(point.speed * 1000); // mm/s
            }
            if (point.calories) {
                recordMessage.calories = Math.round(point.calories);
            }

            encoder.onMesg(Profile.MesgNum.RECORD, recordMessage);
        });

        // Lap message
        encoder.onMesg(Profile.MesgNum.LAP, {
            timestamp: summary.endTime ?? summary.startTime,
            startTime: summary.startTime,
            totalElapsedTime: summary.duration, // seconds
            totalTimerTime: summary.duration,
            totalDistance: Math.round(summary.distance * 100), // cm
            totalCalories: Math.round(summary.totalCalories ?? 0),
            avgHeartRate: summary.avgHeartRate ? Math.round(summary.avgHeartRate) : undefined,
            maxHeartRate: summary.maxHeartRate ? Math.round(summary.maxHeartRate) : undefined,
            avgPower: summary.avgPower ? Math.round(summary.avgPower) : undefined,
            maxPower: summary.maxPower ? Math.round(summary.maxPower) : undefined,
            totalStrokes: summary.totalStrokes,
            avgStrokeDistance: summary.totalStrokes && summary.distance
                ? Math.round((summary.distance / summary.totalStrokes) * 100) // cm
                : undefined,
            sport: SPORT,
            subSport: SUB_SPORT,
            lapTrigger: FitLapTrigger.MANUAL,
            event: FitEvent.LAP,
            eventType: FitEventType.STOP,
        });

        // Session message
        encoder.onMesg(Profile.MesgNum.SESSION, {
            timestamp: summary.endTime ?? summary.startTime,
            startTime: summary.startTime,
            totalElapsedTime: summary.duration,
            totalTimerTime: summary.duration,
            totalDistance: Math.round(summary.distance * 100), // cm
            totalCalories: Math.round(summary.totalCalories ?? 0),
            avgHeartRate: summary.avgHeartRate ? Math.round(summary.avgHeartRate) : undefined,
            maxHeartRate: summary.maxHeartRate ? Math.round(summary.maxHeartRate) : undefined,
            avgPower: summary.avgPower ? Math.round(summary.avgPower) : undefined,
            maxPower: summary.maxPower ? Math.round(summary.maxPower) : undefined,
            totalStrokes: summary.totalStrokes,
            sport: SPORT,
            subSport: SUB_SPORT,
            firstLapIndex: 0,
            numLaps: 1,
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
