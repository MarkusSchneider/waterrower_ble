import { PrimaryService } from 'bleno';
import debug from 'debug';
import { FitnessMachineServiceUUID } from '../uuids';
import { IndoorBikeFeatureCharacteristic } from './IndoorBike';
const logger = debug('FTMS_SRV');

export class FitnessMachineService extends PrimaryService {

    public constructor() {
        logger(`[${FitnessMachineServiceUUID}][FitnessMachineService] constructor`);

        const indoorBikeFeatureCharacteristic: IndoorBikeFeatureCharacteristic = new IndoorBikeFeatureCharacteristic();

        super({
            uuid: FitnessMachineServiceUUID,
            characteristics: [
                indoorBikeFeatureCharacteristic,
            ],
        });
    }
}
