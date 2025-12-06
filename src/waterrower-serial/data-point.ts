import { DataPointName } from './datapoints-config';

export interface DataPoint {
    time: Date;
    name: DataPointName;
    address: string;
    length: number;
    value: number;
}
