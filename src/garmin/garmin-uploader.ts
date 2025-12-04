import debug from 'debug';
import { readFileSync } from 'fs';
import { GarminConnect } from 'garmin-connect';
import { UploadFileType } from 'garmin-connect/dist/garmin/types';

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
     * Upload a FIT file to Garmin Connect
     */
    public async uploadActivity(fitFilePath: string): Promise<UploadResult> {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated. Please login first.');
        }

        try {
            logger(`Uploading FIT file: ${fitFilePath}`);

            // Read the FIT file
            const fitData = readFileSync(fitFilePath, { encoding: 'utf-8' });

            // Upload to Garmin Connect
            // The garmin-connect library expects the file as a buffer
            const result: any = await this.garminClient.uploadActivity(fitData, UploadFileType.fit);

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
     * Upload a FIT file from buffer
     */
    public async uploadActivityFromBuffer(
        fitBuffer: Buffer,
        activityName = 'WaterRower Indoor Rowing'
    ): Promise<UploadResult> {
        if (!this.isAuthenticated) {
            throw new Error('Not authenticated. Please login first.');
        }

        try {
            logger('Uploading FIT file from buffer...');

            const result: any = await (this.garminClient as any).uploadActivity(fitBuffer as any, {
                fileType: 'fit',
                activityName
            });

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
     * Logout from Garmin Connect
     */
    public async logout(): Promise<void> {
        if (this.isAuthenticated) {
            try {
                logger('Logging out from Garmin Connect...');
                // Logout method may not be available in all versions
                if (typeof (this.garminClient as any).logout === 'function') {
                    await (this.garminClient as any).logout();
                }
                this.isAuthenticated = false;
                logger('Successfully logged out');
            } catch (error) {
                logger('Logout error:', error);
                // Still mark as not authenticated even if logout fails
                this.isAuthenticated = false;
            }
        }
    }

    /**
     * Get user profile info (for testing/verification)
     */
    public async getUserProfile(): Promise<any> {
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
