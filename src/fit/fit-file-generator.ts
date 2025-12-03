import debug from 'debug';
import EasyFit, { FitFileData } from 'easy-fit';
import { writeFileSync } from 'fs';

import {
  SessionSummary,
  TrainingDataPoint,
} from '../training/training-session';

const logger = debug('FIT_GENERATOR');

export interface FitFileOptions {
    outputPath: string;
    manufacturer?: string;
    product?: string;
    serialNumber?: number;
}

export class FitFileGenerator {
    private easyFit: EasyFit;

    constructor() {
        this.easyFit = new EasyFit({
            force: true,
            speedUnit: 'km/h',
            lengthUnit: 'm',
            temperatureUnit: 'celsius',
            elapsedRecordField: true,
            mode: 'cascade',
        });
    }

    /**
     * Generate a FIT file from training session data
     * Using Concept2 rower profile for compatibility with Garmin
     */
    public generateFitFile(
        summary: SessionSummary,
        dataPoints: TrainingDataPoint[],
        options: FitFileOptions
    ): Buffer {
        logger('Generating FIT file...');

        const fitData: FitFileData = {
            file_id: {
                type: 'activity',
                manufacturer: 'concept2', // Use Concept2 for rowing compatibility
                product: 20, // Concept2 PM5 product ID
                time_created: this.toFitTimestamp(summary.startTime),
                serial_number: options.serialNumber ?? 123456,
            },
            file_creator: {
                software_version: 100,
            },
            activity: {
                timestamp: this.toFitTimestamp(summary.endTime ?? summary.startTime),
                total_timer_time: summary.duration * 1000, // milliseconds
                num_sessions: 1,
                type: 'manual',
                event: 'activity',
                event_type: 'stop',
            },
            session: {
                timestamp: this.toFitTimestamp(summary.endTime ?? summary.startTime),
                start_time: this.toFitTimestamp(summary.startTime),
                total_elapsed_time: summary.duration * 1000, // milliseconds
                total_timer_time: summary.duration * 1000,
                total_distance: summary.distance,
                total_calories: Math.round(summary.totalCalories ?? 0),
                avg_heart_rate: summary.avgHeartRate ? Math.round(summary.avgHeartRate) : undefined,
                max_heart_rate: summary.maxHeartRate ? Math.round(summary.maxHeartRate) : undefined,
                avg_power: summary.avgPower ? Math.round(summary.avgPower) : undefined,
                max_power: summary.maxPower ? Math.round(summary.maxPower) : undefined,
                total_strokes: summary.totalStrokes,
                sport: 'rowing', // Rowing sport type
                sub_sport: 'indoor_rowing',
                first_lap_index: 0,
                num_laps: 1,
                event: 'session',
                event_type: 'stop',
                trigger: 'activity_end',
            },
            lap: {
                timestamp: this.toFitTimestamp(summary.endTime ?? summary.startTime),
                start_time: this.toFitTimestamp(summary.startTime),
                total_elapsed_time: summary.duration * 1000,
                total_timer_time: summary.duration * 1000,
                total_distance: summary.distance,
                total_calories: Math.round(summary.totalCalories ?? 0),
                avg_heart_rate: summary.avgHeartRate ? Math.round(summary.avgHeartRate) : undefined,
                max_heart_rate: summary.maxHeartRate ? Math.round(summary.maxHeartRate) : undefined,
                avg_power: summary.avgPower ? Math.round(summary.avgPower) : undefined,
                max_power: summary.maxPower ? Math.round(summary.maxPower) : undefined,
                total_strokes: summary.totalStrokes,
                avg_stroke_distance: summary.totalStrokes && summary.distance
                    ? summary.distance / summary.totalStrokes
                    : undefined,
                sport: 'rowing',
                sub_sport: 'indoor_rowing',
                lap_trigger: 'session_end',
                event: 'lap',
                event_type: 'stop',
            },
            record: this.generateRecords(dataPoints, summary.startTime),
            device_info: [
                {
                    timestamp: this.toFitTimestamp(summary.startTime),
                    manufacturer: 'concept2',
                    product: 20, // PM5
                    serial_number: options.serialNumber ?? 123456,
                    device_index: 0,
                    source_type: 'local',
                }
            ],
        };

        // Encode to FIT format
        const buffer = Buffer.from(this.easyFit.encode(fitData));

        // Save to file
        writeFileSync(options.outputPath, buffer);
        logger(`FIT file saved to: ${options.outputPath}`);

        return buffer;
    }

    private generateRecords(
        dataPoints: TrainingDataPoint[],
        startTime: Date
    ): FitFileData['record'] {
        return dataPoints.map((point) => {
            const record: any = {
                timestamp: this.toFitTimestamp(point.timestamp),
                distance: point.distance,
                heart_rate: point.heartRate ? Math.round(point.heartRate) : undefined,
                power: point.power ? Math.round(point.power) : undefined,
                cadence: point.strokeRate, // Stroke rate as cadence
                speed: point.speed,
                calories: point.calories ? Math.round(point.calories) : undefined,
            };

            // Remove undefined values
            Object.keys(record).forEach(key => {
                if (record[key] === undefined) {
                    delete record[key];
                }
            });

            return record;
        });
    }

    /**
     * Convert JavaScript Date to FIT timestamp
     * FIT time is seconds since UTC 00:00 Dec 31 1989
     */
    private toFitTimestamp(date: Date): number {
        const FIT_EPOCH = new Date('1989-12-31T00:00:00Z').getTime();
        return Math.floor((date.getTime() - FIT_EPOCH) / 1000);
    }

    /**
     * Parse a FIT file (utility method for testing/debugging)
     */
    public parseFitFile(filePath: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.easyFit.parse(filePath, (error: any, data: any) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(data);
                }
            });
        });
    }
}
