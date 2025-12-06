import { DataPointName } from './datapoints-config';

export const DEFAULT_WATER_ROWER_OPTIONS: WaterRowerOptions = {
    baudRate: 19200,
    dataDirectory: 'data',
    datapoints: [],
    portName: '',
    refreshRate: 200,
};

export interface WaterRowerOptions {
    baudRate: number;
    dataDirectory: string;
    datapoints: DataPointName | Array<DataPointName> | undefined;
    portName: string;
    refreshRate: number;
}
