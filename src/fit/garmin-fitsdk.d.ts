// Type declarations for @garmin/fitsdk
// The official SDK doesn't ship with TypeScript types
declare module '@garmin/fitsdk' {
    export class Encoder {
        constructor();
        onMesg(mesgNum: number, data: any): void;
        writeMesg(data: any): void;
        close(): Uint8Array;
        addDeveloperField(fieldNum: number, data: any): void;
    }

    export class Decoder {
        constructor(stream?: any);
        decode(buffer: Buffer | Uint8Array): any;
        read(options?: any): { messages: any; errors: any[] };
        isFIT(): boolean;
        checkIntegrity(): boolean;
        static isFIT(stream: any): boolean;
    }

    export class Stream {
        static fromByteArray(array: Uint8Array): any;
        static fromBuffer(buffer: Buffer): any;
        static fromArrayBuffer(buffer: ArrayBuffer): any;
    }

    export namespace Profile {
        export enum MesgNum {
            FILE_ID = 0,
            FILE_CREATOR = 49,
            TIMESTAMP_CORRELATION = 162,
            SOFTWARE = 35,
            CAPABILITIES = 1,
            FILE_CAPABILITIES = 37,
            DEVICE_SETTINGS = 2,
            USER_PROFILE = 3,
            SPORT = 12,
            HR_ZONE = 8,
            SPEED_ZONE = 53,
            CADENCE_ZONE = 131,
            POWER_ZONE = 9,
            MET_ZONE = 10,
            GOAL = 15,
            ACTIVITY = 34,
            SESSION = 18,
            LAP = 19,
            LENGTH = 101,
            RECORD = 20,
            EVENT = 21,
            DEVICE_INFO = 23,
            TRAINING_FILE = 72,
            HRV = 78,
        }

        export const version: string;
        export const messages: any;
        export const types: any;
        export const CommonFields: any;

        export function getEnum(typeName: string): any;
        export function getMesg(mesgName: string): any;
        export function getField(mesgNum: number, fieldNum: number): any;
    }

    export namespace Utils {
        export const FIT_EPOCH_MS: number;
        export function convertDateTimeToDate(fitDateTime: number): Date;
    }

    export class CrcCalculator {
        static calculate(data: Uint8Array): number;
    }
}
