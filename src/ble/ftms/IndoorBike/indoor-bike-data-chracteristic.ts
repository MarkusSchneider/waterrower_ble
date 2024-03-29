import { Characteristic, Descriptor } from '@abandonware/bleno';
import debug from 'debug';
import { CharacteristicUserDescriptionUUID, IndoorBikeDataUUID } from '../../uuids';
import { IndoorBikeDataFlag } from './indoor-bike-data';

const logger = debug('FTMS');
export class IndoorBikeDataCharacteristic extends Characteristic {

    private _updateValueCallback: ((data: Buffer) => void) | null = null;
    private _power: number = 0;
    private _cadence: number = 0;

    public constructor() {
        logger(`[${IndoorBikeDataUUID}][IndoorBikeDataCharacteristic] constructor`);
        super({
            uuid: IndoorBikeDataUUID,
            properties: ['notify'],
            descriptors: [
                new Descriptor({
                    uuid: CharacteristicUserDescriptionUUID,
                    value: 'Indoor Bike Data',
                }),
            ],
        });
    }

    public onReadRequest(_offset: number, callback: (result: number, data?: Buffer) => void): void {
        logger(`[${IndoorBikeDataUUID}][IndoorBikeDataCharacteristic] onReadRequest`);

        // Flags (16bit)
        // cadence (16bit)
        // power (16bit)
        const data = Buffer.alloc(6);
        data.writeUInt32LE(IndoorBikeDataFlag.InstantaneousCadence | IndoorBikeDataFlag.InstantaneousPowerPresent | IndoorBikeDataFlag.MoreData);
        data.writeUInt16LE(0, 2);
        data.writeUInt16LE(0, 4);

        callback(this.RESULT_SUCCESS, data);
    }

    public onSubscribe(_maxValueSize: number, updateValueCallback: (data: Buffer) => void): void {
        logger(`[${IndoorBikeDataUUID}][IndoorBikeDataCharacteristic] onSubscribe`);
        this._updateValueCallback = updateValueCallback;
    }

    onUnsubscribe(): void {
        logger(`[${IndoorBikeDataUUID}][IndoorBikeDataCharacteristic] onUnsubscribe`);
        this._updateValueCallback = null;
    }

    public updateData(power: number | null, cadence: number | null): void {
        if (this._updateValueCallback == null) {
            return;
        }

        if (power === Number.NaN || cadence === Number.NaN) {
            logger(`[${IndoorBikeDataUUID}][IndoorBikeDataCharacteristic] error invalid values. Power = ${power}, Cadence = ${cadence}`);
        }

        cadence = cadence == null ? this._cadence : cadence;
        power = power == null ? this._power : power;
        if (power == 0 && cadence > 0) {
            power = this._power;
        }

        this._power = power;
        this._cadence = cadence;

        const data = Buffer.alloc(6);
        data.writeUInt16LE(IndoorBikeDataFlag.InstantaneousCadence | IndoorBikeDataFlag.InstantaneousPowerPresent | IndoorBikeDataFlag.MoreData);
        data.writeUInt16LE(this._cadence * 8, 2);
        data.writeUInt16LE(this._power * 1.5, 4);

        this._updateValueCallback(data);

    }
}
