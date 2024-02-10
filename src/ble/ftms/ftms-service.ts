import debug from 'debug';
import { FitnessMachineServiceUUID } from '../uuids';
import { IndoorBikeFeatureCharacteristic } from './IndoorBike';
import { PrimaryService } from '@abandonware/bleno';
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
