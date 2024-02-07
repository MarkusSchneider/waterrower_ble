export interface DataPointDefinition {
    name: string;
    address: string;
    length: 'D' | 'S' | 'A';
    radix: 10 | 16;
    value: number;
}

export const DataPoints: Array<DataPointDefinition> = [
    //performance variables
    { name: 'mph', address: '1A3', length: 'D', radix: 10, value: 0 },
    { name: 'stroke_rate', address: '1A9', length: 'S', radix: 10, value: 0 },

    //screen mode variables
    { name: 'screen_mode', address: '00D', length: 'S', radix: 16, value: 0 },
    { name: 'screen_sub_mode', address: '00E', length: 'S', radix: 16, value: 0 },
    { name: 'screen_interval', address: '00F', length: 'S', radix: 16, value: 0 },

    //distance variables
    { name: 'ms_distance_dec', address: '054', length: 'S', radix: 16, value: 0 },
    { name: 'ms_distance', address: '055', length: 'D', radix: 16, value: 0 },
    { name: 'distance', address: '057', length: 'D', radix: 16, value: 0 },
    { name: 'test_count', address: '059', length: 'S', radix: 16, value: 0 },

    //clock countdown
    { name: 'clock_down_dec', address: '05A', length: 'A', radix: 16, value: 0 },
    { name: 'clock_down', address: '05B', length: 'D', radix: 16, value: 0 },

    //total distance meter counter
    { name: 'total_dis_dec', address: '080', length: 'S', radix: 16, value: 0 },
    { name: 'total_dis', address: '081', length: 'D', radix: 16, value: 0 },

    //?
    { name: 'pins_per_xxcm', address: '083', length: 'S', radix: 16, value: 0 },
    { name: 'distance_xxcm', address: '084', length: 'S', radix: 16, value: 0 },

    //Locations between these are not used and should read as 0, these maybe used if space is required
    { name: 'kcal_watts', address: '088', length: 'D', radix: 16, value: 0 },
    { name: 'total_kcal', address: '08A', length: 'D', radix: 16, value: 0 },

    //tank volume in liters
    { name: 'tank_volume', address: '0A9', length: 'S', radix: 16, value: 0 },

    //BANK 1
    //stroke counter
    //stroke_pull is first subtracted from stroke_average then a modifier of 1.25 multiplied by the result to generate the ratio value for display
    { name: 'strokes_cnt', address: '140', length: 'D', radix: 16, value: 0 },
    { name: 'stroke_average', address: '142', length: 'S', radix: 16, value: 0 },
    { name: 'stroke_pull', address: '143', length: 'S', radix: 16, value: 0 },

    //meters per second register
    { name: 'm_s_total', address: '148', length: 'D', radix: 16, value: 0 },
    { name: 'm_s_average', address: '14A', length: 'D', radix: 16, value: 0 },
    { name: 'm_s_stored', address: '14C', length: 'S', radix: 16, value: 0 },
    { name: 'm_s_proj_avg', address: '14D', length: 'D', radix: 16, value: 0 },

    //used to generate the display clock
    { name: 'display_sec_dec', address: '1E0', length: 'S', radix: 10, value: 0 },
    { name: 'display_sec', address: '1E1', length: 'S', radix: 10, value: 0 },
    { name: 'display_min', address: '1E2', length: 'S', radix: 10, value: 0 },
    { name: 'display_hr', address: '1E3', length: 'S', radix: 10, value: 0 },

    //workout total times/distances/limits
    { name: 'workout_time', address: '1E8', length: 'D', radix: 16, value: 0 },
    { name: 'workout_ms', address: '1EA', length: 'D', radix: 16, value: 0 },
    { name: 'workout_stroke', address: '1EC', length: 'D', radix: 16, value: 0 },
    { name: 'workout_limit', address: '1EE', length: 'D', radix: 16, value: 0 },
];