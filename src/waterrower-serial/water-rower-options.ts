
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
    datapoints: string | Array<string> | undefined;
    portName: string;
    refreshRate: number;
}
