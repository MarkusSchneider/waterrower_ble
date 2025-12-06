// S4 Water Rower Monitor Data Point Configuration
// ========================================
//
// ; Distance variables
// ms_distance_dec 054 ; 0.1m count (only counts up from 0-9)
// ms_distance_low 055 ; low byte of meters
// ms_distance_hi 056 ; hi byte of meters and km (65535meters max)
// ;
// ; this is the displayed distance
// distance_low 057 ; low byte of meters
// distance_hi 058 ; hi byte of meters and km (65535meters max)
// test_count 059 ; used by test routines
// ;
// ; CLock count down, this is 16bit value.
// clock_down_dec 05a ; seconds 0.9-0.0
// clock_down_low 05b ; low byte clock count down
// clock_down_hi 05c ; hi byte clock count down
// ;
// ; total distance meter counter - this is stored at switch off
// total_dis_dec 080; dec byte of meters
// total_dis_low 081; low byte of meters
// total_dis_hi 082; hi byte of meters and km(65535meters max)
// ;
// pins_per_xxcm 083; number of pin edges allowed to equal xxcm
// distance_xxcm 084; number of cm per flaged xxcm no.of pins
// ;
// ; Locations between these are not used and should read as 0, these maybe used if space is required
// kcal_watts_low 088
// kcal_watts_hi 089
// total_kcal_low 08a
// total_kcal_hi 08b
// total_kcal_up 08c
// ;
// ; zone values, this are kept even during a reset, but not on a power on
// zone_hr_hi 090; hi setting for the heartrate
// zone_hr_low 091; low setting for the heartrate
// z_int_m_s_hmsb 092; hi setting for the intensity
// z_int_m_s_hlsb 093; low setting for the intensity
// z_int_m_s_lmsb 094; hi setting for the intensity
// z_int_m_s_llsb 095; low setting for the intensity
// z_int_mph_hmsb 096; hi setting for the intensity
// z_int_mph_hlsb 097; low setting for the intensity
// z_int_mph_lmsb 098; hi setting for the intensity
// z_int_mph_llsb 099; low setting for the intensity
// z_int_500m_hmsb 09a; hi setting for the intensity
// z_int_500m_hlsb 09b; low setting for the intensity
// z_int_500m_lmsb 09c; hi setting for the intensity
// z_int_500m_llsb 09d; low setting for the intensity
// z_int_2km_hmsb 09e; hi setting for the intensity
// z_int_2km_hlsb 09f; low setting for the intensity
// z_int_2km_lmsb 0a0; hi setting for the intensity
// z_int_2km_llsb 0a1; low setting for the intensity
// zone_sr_hi 0a2; hi setting for the strokerate
// zone_sr_low 0a3; low setting for the strokerate
// ;
// ; advanced workout prognostic variables
// prognostic_sech 0a4; prognostic seconds hi and low
// prognostic_secl 0a5; 16 bit value
// prognostic_cmsu 0a6; prognostic cm / s(multiplied by 100)
// prognostic_cmsh 0a7; this is the constance for the maths.
// prognostic_cmsl 0a8; results is a 24bit value
// ;
// ; tank volume in liters
// tank_volume 0a9; volume of water in tank
//
// ; BANK 1
// ; ======
// ;
// ; Stroke counter
// strokes_cnt_low 140; low byte count
// strokes_cnt_hi 141; high byte count
// stroke_average 142; average time for a whole stroke
// stroke_pull 143; average time for a pull(acc to dec)
// Stroke_pull is first subtracted from stroke_average then a modifier of 1.25 multiplied by the result to
// 
// ; generate the ratio value for display.
// ;
// ; Meters per second registers
// m_s_low_total 148; total distance per second in cm low byte
// m_s_hi_total 149; total distance per second in cm hi byte
// m_s_low_average 14a; instant average distance in cm low byte
// m_s_hi_average 14b; instant average distance in cm hi byte
// m_s_stored 14c; no.of the stored values.
// m_s_projl_avg 14d; all average for projected distance / duration maths
// m_s_projh_avg 14e; all average for projected distance / duration maths
// ;
// ; Zone maths - these are used each time the routine is ran
// zone_hi_msb 190; high byte msb
// zone_hi_lsb 191; high byte lsb
// zone_low_msb 192; low byte msb
// zone_low_lsb 193; low byte lsb
// zone_sec_msb 194; sector size to perform scaling msb
// zone_sec_lsb 195; sector size to perform scaling lsb
// zone_val_msb 196; value of operation msb
// zone_val_lsb 197; value of operation lsb
// zone_range_mhi 198; range scaled for hi byte msb
// zone_range_lhi 199; range scaled for hi byte lsb
// zone_range_mlow 19a; range scaled for low byte msb
// zone_range_llow 19b; range scaled for low byte lsb
// zone_range_mval 19c; range scaled for the input value byte msb
// zone_range_lval 19d; range scaled for the input value byte lsb
// ;
// ; stored values for the zone maths above(these are pre display values)
// zone_hr_val 1a0; heart rate stored value
// zone_m_s_hval 1a1; m / s hi stored value(cm / s)
// zone_m_s_lval 1a2; m / s low stored value(cm / s)
// zone_mph_hval 1a3; mph hi stored value(xx.x)
// zone_mph_lval 1a4; mph low stored value(xx.x)
// zone_500m_hval 1a5; 500m hi stored value(sec's)
// zone_500m_lval 1a6 ; 500m low stored value(sec's
// zone_2km_hval 1a7 ; 2km hi stored value(sec's)
// zone_2km_lval 1a8 ; 2km low stored value(sec's)
// zone_sr_val 1a9 ; stroke rate stored value
// ;
// ; Interval's
// ; ----------
// ;
// ; These are the interval timing's in use or being programmed.
// workout_work1_l 1b0
// workout_work1_h 1b1
// workout_rest1_l 1b2
// workout_rest1_h 1b3
// workout_work2_l 1b4
// workout_work2_h 1b5
// workout_rest2_l 1b6
// workout_rest2_h 1b7
// workout_work3_l 1b8
// workout_work3_h 1b9
// workout_rest3_l 1ba
// workout_rest3_h 1bb
// workout_work4_l 1bc
// workout_work4_h 1bd
// workout_rest4_l 1be
// workout_rest4_h 1bf
// workout_work5_l 1c0
// workout_work5_h 1c1
// workout_rest5_l 1c2
// workout_rest5_h 1c3
// workout_work6_l 1c4
// workout_work6_h 1c5
// workout_rest6_l 1c6
// workout_rest6_h 1c7
// workout_work7_l 1c8
// workout_work7_h 1c9
// workout_rest7_l 1ca
// workout_rest7_h 1cb
// workout_work8_l 1cc
// workout_work8_h 1cd
// workout_rest8_l 1ce
// workout_rest8_h 1cf
// workout_work9_l 1d0
// workout_work9_h 1d1
// workout_inter 1d9; No work workout intervals
// ;
// ; used to generate the display clock
// display_sec_dec 1e0; seconds 0.0 - 0.9
// display_sec 1e1; seconds 0 - 59
// display_min 1e2; minutes 0 - 59
// display_hr 1e3; hours 0 - 9 only
// ;
// ; workout total times / distances / limits
// workout_timel 1e8; total workout time
// workout_timeh 1e9
// workout_ms_l 1ea; total workout m / s
// workout_ms_h 1eb
// workout_strokel 1ec; total workout strokes
// workout_strokeh 1ed
// workout_limit_h 1ee; this is the limit value for workouts
// workout_limit_l 1ef
// ;
// ; heart rate analysis variables
// hr_above_tenths 1f0 ; time above heart zone
// hr_above_low 1f1
// hr_above_hi 1f2
// hr_in_tenths 1f3 ; time in heart zone
// hr_in_low 1f4
// hr_in_hi 1f5
// hr_below_tenths 1f6 ; time below heart zone
// hr_below_low 1f7
// hr_below_hi 1f8
// hr_peak 1f9 ; peak heartrate (always)

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
    { name: 'stroke_rate', address: '1A9', length: 'S', radix: 16, value: 0 },

    //screen mode variables
    { name: 'screen_mode', address: '00D', length: 'S', radix: 16, value: 0 },
    { name: 'screen_sub_mode', address: '00E', length: 'S', radix: 16, value: 0 },
    { name: 'screen_interval', address: '00F', length: 'S', radix: 16, value: 0 },

    //distance variables
    { name: 'm_s_distance_dec', address: '054', length: 'S', radix: 16, value: 0 },
    { name: 'm_s_distance', address: '055', length: 'D', radix: 16, value: 0 },
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