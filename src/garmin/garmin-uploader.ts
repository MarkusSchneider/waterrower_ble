import debug from 'debug';
import { readFileSync } from 'fs';
import { GarminConnect } from 'garmin-connect';
import { ISocialProfile, UploadFileType } from 'garmin-connect/dist/garmin/types';

const logger = debug('GARMIN_UPLOADER');

export interface GarminCredentials {
    email: string;
    password: string;
}

export interface UploadResult {
    success: boolean;
    activityId?: number;
    error?: string;
}

export class GarminUploader {
    private garminClient: GarminConnect;
    private isAuthenticated = false;

    constructor() {
        this.garminClient = new GarminConnect({
            username: '',
            password: ''
        });
    }

    /**
     * Login to Garmin Connect
     */
    public async login(credentials: GarminCredentials): Promise<void> {
        try {
            logger('Logging in to Garmin Connect...');

            // Set credentials
            this.garminClient = new GarminConnect({
                username: credentials.email,
                password: credentials.password
            });

            await this.garminClient.login();
            this.isAuthenticated = true;

            logger('Successfully logged in to Garmin Connect');
        } catch (error) {
            logger('Login failed:', error);
            this.isAuthenticated = false;
            throw new Error(`Garmin Connect login failed: ${error}`);
        }
    }

    /**
     * Upload a FIT file from file path
     */
    public async uploadActivity(fitFilePath: string): Promise<UploadResult> {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated. Please login first.');
        }

        try {
            logger(`Uploading FIT file from: ${fitFilePath}`);

            const result: any = await this.garminClient.uploadActivity(fitFilePath, 'fit');

            logger(`Upload successful. Activity ID: ${result?.activityId}`);

            return {
                success: true,
                activityId: result?.activityId
            };
        } catch (error: any) {
            logger('Upload failed:', error);

            return {
                success: false,
                error: error.message || 'Unknown error during upload'
            };
        }
    }

    /**
     * Check if authenticated
     */
    public isLoggedIn(): boolean {
        return this.isAuthenticated;
    }

    /**
     * Get user profile info (for testing/verification)
     */
    public async getUserProfile(): Promise<ISocialProfile> {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated. Please login first.');
        }

        try {
            const profile = await this.garminClient.getUserProfile();
            return profile;
        } catch (error) {
            logger('Failed to get user profile:', error);
            throw error;
        }
    }
}
