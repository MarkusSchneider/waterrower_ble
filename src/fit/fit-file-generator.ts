import debug from 'debug';
import { writeFileSync } from 'fs';
import { Builder, Decoder } from '@markw65/fit-file-writer';

import {
    SessionSummary,
    TrainingDataPoint,
} from '../training/training-session';
import { ConfigManager } from '../helper/config-manager';

const logger = debug('FIT_GENERATOR');

const SERIAL_NUMBER = 123456; // Default serial number if not provided
const FIT_EPOCH = new Date('1989-12-31T00:00:00Z').getTime();

export class FitFileGenerator {
    constructor(private configManager: ConfigManager) { }

    /**
     * Generate a FIT file from training session data
     * Using Concept2 rower profile for compatibility with Garmin
     */
    public generateFitFile(
        summary: SessionSummary,
        dataPoints: TrainingDataPoint[],
    ): Buffer {
        logger('Generating FIT file...');

        const builder = new Builder();
        const timestamp = this.toFitTimestamp(summary.startTime);
        const endTimestamp = this.toFitTimestamp(summary.endTime ?? summary.startTime);

        // File ID message
        builder.addMessage(0, 'file_id', {
            type: 4, // activity
            manufacturer: 17, // concept2
            product: 20, // Concept2 PM5 product ID
            time_created: timestamp,
            serial_number: SERIAL_NUMBER,
        });

        // Device Info message
        builder.addMessage(0, 'device_info', {
            timestamp: timestamp,
            manufacturer: 17, // concept2
            product: 20, // PM5
            serial_number: SERIAL_NUMBER,
            device_index: 0,
            source_type: 5, // local
        });

        // Sport message
        builder.addMessage(0, 'sport', {
            sport: 15, // rowing
            sub_sport: 14, // indoor_rowing
        });

        // Record messages (data points)
        dataPoints.forEach((point) => {
            const recordMessage: any = {
                timestamp: this.toFitTimestamp(point.timestamp),
                distance: Math.round(point.distance * 100), // cm
                cadence: point.strokeRate, // Stroke rate as cadence
            };

            if (point.heartRate) {
                recordMessage.heart_rate = Math.round(point.heartRate);
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

            builder.addMessage(0, 'record', recordMessage);
        });

        // Lap message
        builder.addMessage(0, 'lap', {
            timestamp: endTimestamp,
            start_time: timestamp,
            total_elapsed_time: summary.duration * 1000, // milliseconds
            total_timer_time: summary.duration * 1000,
            total_distance: Math.round(summary.distance * 100), // cm
            total_calories: Math.round(summary.totalCalories ?? 0),
            avg_heart_rate: summary.avgHeartRate ? Math.round(summary.avgHeartRate) : undefined,
            max_heart_rate: summary.maxHeartRate ? Math.round(summary.maxHeartRate) : undefined,
            avg_power: summary.avgPower ? Math.round(summary.avgPower) : undefined,
            max_power: summary.maxPower ? Math.round(summary.maxPower) : undefined,
            total_strokes: summary.totalStrokes,
            avg_stroke_distance: summary.totalStrokes && summary.distance
                ? Math.round((summary.distance / summary.totalStrokes) * 100) // cm
                : undefined,
            sport: 15, // rowing
            sub_sport: 14, // indoor_rowing
            lap_trigger: 0, // manual
            event: 9, // lap
            event_type: 1, // stop
        });

        // Session message
        builder.addMessage(0, 'session', {
            timestamp: endTimestamp,
            start_time: timestamp,
            total_elapsed_time: summary.duration * 1000,
            total_timer_time: summary.duration * 1000,
            total_distance: Math.round(summary.distance * 100), // cm
            total_calories: Math.round(summary.totalCalories ?? 0),
            avg_heart_rate: summary.avgHeartRate ? Math.round(summary.avgHeartRate) : undefined,
            max_heart_rate: summary.maxHeartRate ? Math.round(summary.maxHeartRate) : undefined,
            avg_power: summary.avgPower ? Math.round(summary.avgPower) : undefined,
            max_power: summary.maxPower ? Math.round(summary.maxPower) : undefined,
            total_strokes: summary.totalStrokes,
            sport: 15, // rowing
            sub_sport: 14, // indoor_rowing
            first_lap_index: 0,
            num_laps: 1,
            event: 8, // session
            event_type: 1, // stop
            trigger: 0, // activity_end
        });

        // Activity message
        builder.addMessage(0, 'activity', {
            timestamp: endTimestamp,
            total_timer_time: summary.duration * 1000,
            num_sessions: 1,
            type: 0, // manual
            event: 26, // activity
            event_type: 1, // stop
        });

        // Build the FIT file
        const buffer = builder.build();

        // Save to file
        const outputPath = this.configManager.getFitFilesDirectory();
        const fileName = `waterrower_${new Date().getTime()}.fit`;
        const fullPath = `${outputPath}/${fileName}`;
        writeFileSync(fullPath, buffer);
        logger(`FIT file saved to: ${fullPath}`);

        return buffer;
    }

    /**
     * Convert JavaScript Date to FIT timestamp
     * FIT time is seconds since UTC 00:00 Dec 31 1989
     */
    private toFitTimestamp(date: Date): number {
        return Math.floor((date.getTime() - FIT_EPOCH) / 1000);
    }

    /**
     * Parse a FIT file (utility method for testing/debugging)
     */
    public parseFitFile(filePath: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const decoder = new Decoder();
            try {
                const buffer = require('fs').readFileSync(filePath);
                const result = decoder.decode(buffer);
                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
    }
}
