import debug from 'debug';
import { FitnessMachineServiceUUID } from '../uuids';
import { IndoorBikeFeatureCharacteristic } from './IndoorBike';
import { PrimaryService } from '@stoprocent/bleno';
import { IndoorBikeDataCharacteristic } from './IndoorBike/indoor-bike-data-chracteristic';
const logger = debug('FTMS_SRV');

export class FitnessMachineService extends PrimaryService {
    private readonly _indoorBikeDataCharacteristic: IndoorBikeDataCharacteristic;
    public constructor() {
        logger(`[${FitnessMachineServiceUUID}][FitnessMachineService] constructor`);

        const indoorBikeFeatureCharacteristic: IndoorBikeFeatureCharacteristic = new IndoorBikeFeatureCharacteristic();
        const indoorBikeDataCharacteristic: IndoorBikeDataCharacteristic = new IndoorBikeDataCharacteristic();

        super({
            uuid: FitnessMachineServiceUUID,
            characteristics: [
                indoorBikeFeatureCharacteristic,
                indoorBikeDataCharacteristic
            ],
        });

        this._indoorBikeDataCharacteristic = indoorBikeDataCharacteristic;
    }

    public updateData(power: number | null, cadence: number | null): void {
        this._indoorBikeDataCharacteristic.updateData(power, cadence);
    }
}
