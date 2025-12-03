declare module 'easy-fit' {
    export interface EasyFitOptions {
        force?: boolean;
        speedUnit?: 'km/h' | 'm/s' | 'mph';
        lengthUnit?: 'm' | 'km' | 'mi';
        temperatureUnit?: 'celsius' | 'fahrenheit' | 'kelvin';
        elapsedRecordField?: boolean;
        mode?: 'cascade' | 'list' | 'both';
    }

    export interface FitFileData {
        file_id?: {
            type?: string;
            manufacturer?: string | number;
            product?: number;
            time_created?: number;
            serial_number?: number;
            [key: string]: any;
        };
        file_creator?: {
            software_version?: number;
            [key: string]: any;
        };
        activity?: {
            timestamp?: number;
            total_timer_time?: number;
            num_sessions?: number;
            type?: string;
            event?: string;
            event_type?: string;
            [key: string]: any;
        };
        session?: {
            timestamp?: number;
            start_time?: number;
            total_elapsed_time?: number;
            total_timer_time?: number;
            total_distance?: number;
            total_calories?: number;
            avg_heart_rate?: number;
            max_heart_rate?: number;
            avg_power?: number;
            max_power?: number;
            total_strokes?: number;
            sport?: string;
            sub_sport?: string;
            first_lap_index?: number;
            num_laps?: number;
            event?: string;
            event_type?: string;
            trigger?: string;
            [key: string]: any;
        };
        lap?: {
            timestamp?: number;
            start_time?: number;
            total_elapsed_time?: number;
            total_timer_time?: number;
            total_distance?: number;
            total_calories?: number;
            avg_heart_rate?: number;
            max_heart_rate?: number;
            avg_power?: number;
            max_power?: number;
            total_strokes?: number;
            avg_stroke_distance?: number;
            sport?: string;
            sub_sport?: string;
            lap_trigger?: string;
            event?: string;
            event_type?: string;
            [key: string]: any;
        };
        record?: Array<{
            timestamp?: number;
            distance?: number;
            heart_rate?: number;
            power?: number;
            cadence?: number;
            speed?: number;
            calories?: number;
            [key: string]: any;
        }>;
        device_info?: Array<{
            timestamp?: number;
            manufacturer?: string | number;
            product?: number;
            serial_number?: number;
            device_index?: number;
            source_type?: string;
            [key: string]: any;
        }>;
        [key: string]: any;
    }

    export interface ParseCallback {
        (error: Error | null, data: any): void;
    }

    export default class EasyFit {
        constructor(options?: EasyFitOptions);

        /**
         * Encode FIT file data to a buffer
         */
        encode(data: FitFileData): ArrayBuffer;

        /**
         * Parse a FIT file
         */
        parse(filePath: string, callback: ParseCallback): void;
    }
}
