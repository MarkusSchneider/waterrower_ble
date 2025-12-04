import debug from 'debug';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { mkdirSync } from 'fs';
import * as path from 'path';

const logger = debug('CONFIG_MANAGER');

export interface AppConfig {
    garminCredentials?: {
        email: string;
        password: string;
    };
    hrmDevice?: {
        id: string;
        name: string;
    };
    waterRowerPort?: string;
}

const DEFAULT_CONFIG: AppConfig = {
    garminCredentials: undefined,
    hrmDevice: undefined,
    waterRowerPort: undefined,
};

export class ConfigManager {
    private configPath: string;
    private config: AppConfig;

    constructor(configDir: string = './data') {
        // Ensure config directory exists
        if (!existsSync(configDir)) {
            mkdirSync(configDir, { recursive: true });
        }

        this.configPath = path.join(configDir, 'config.json');
        this.config = this.loadConfig();
    }

    private loadConfig(): AppConfig {
        try {
            if (existsSync(this.configPath)) {
                const data = readFileSync(this.configPath, 'utf-8');
                const loaded = JSON.parse(data) as AppConfig;
                logger('Config loaded from:', this.configPath);
                return { ...DEFAULT_CONFIG, ...loaded };
            }
        } catch (err) {
            logger('Error loading config:', err);
        }
        logger('Using default config');
        return DEFAULT_CONFIG;
    }

    private saveConfig(): void {
        try {
            writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
            logger('Config saved to:', this.configPath);
        } catch (err) {
            logger('Error saving config:', err);
        }
    }

    public getGarminCredentials(): AppConfig['garminCredentials'] {
        return this.config.garminCredentials;
    }

    public setGarminCredentials(email: string, password: string): void {
        this.config.garminCredentials = { email, password };
        this.saveConfig();
        logger('Garmin credentials saved');
    }

    public clearGarminCredentials(): void {
        this.config.garminCredentials = undefined;
        this.saveConfig();
        logger('Garmin credentials cleared');
    }

    public getHRMDevice(): AppConfig['hrmDevice'] {
        return this.config.hrmDevice;
    }

    public setHRMDevice(id: string, name: string): void {
        this.config.hrmDevice = { id, name };
        this.saveConfig();
        logger(`HRM device saved: ${name} (${id})`);
    }

    public clearHRMDevice(): void {
        this.config.hrmDevice = undefined;
        this.saveConfig();
        logger('HRM device cleared');
    }

    public getWaterRowerPort(): string | undefined {
        return this.config.waterRowerPort;
    }

    public setWaterRowerPort(port: string): void {
        this.config.waterRowerPort = port;
        this.saveConfig();
        logger(`WaterRower port saved: ${port}`);
    }

    public clearWaterRowerPort(): void {
        this.config.waterRowerPort = undefined;
        this.saveConfig();
        logger('WaterRower port cleared');
    }

    public getConfig(): AppConfig {
        return { ...this.config };
    }

    public clearAllConfig(): void {
        this.config = DEFAULT_CONFIG;
        this.saveConfig();
        logger('All config cleared');
    }
}
