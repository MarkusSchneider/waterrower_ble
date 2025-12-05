import { Characteristic, Descriptor } from '@stoprocent/bleno';
import debug from 'debug';
import { CharacteristicUserDescriptionUUID, FitnessMachineFeatureUUID } from '../../uuids';
import { FitnessMachineFeatureFlag } from './indoor-bike-data';

const logger = debug('FTMS');
export class IndoorBikeFeatureCharacteristic extends Characteristic {
    public constructor() {
        logger(`[${FitnessMachineFeatureUUID}][IndoorBikeFeatureCharacteristic] constructor`);
        super({
            uuid: FitnessMachineFeatureUUID,
            properties: ['read'],
            descriptors: [
                new Descriptor({
                    uuid: CharacteristicUserDescriptionUUID,
                    value: 'Fitness Machine Feature',
                }),
            ],
        });
    }
    public onReadRequest(_handle: number, _offset: number, callback: (result: number, data?: Buffer) => void): void {
        logger(`[${FitnessMachineFeatureUUID}][IndoorBikeFeatureCharacteristic] onReadRequest`);

        // Fitness Machine Features (32bit), Target Setting Features (32bit)
        const flags = Buffer.alloc(8);
        flags.writeUInt32LE(FitnessMachineFeatureFlag.CadenceSupported | FitnessMachineFeatureFlag.PowerMeasurementSupported);
        flags.writeUInt32LE(0x0000, 4);

        callback(this.RESULT_SUCCESS, flags);
    }
}
