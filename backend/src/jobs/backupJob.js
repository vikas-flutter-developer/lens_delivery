import cron from 'node-cron';
import BackupService from '../utils/BackupService.js';

export const startBackupJobs = () => {
    // 1. Daily Backup - Runs at 02:00 AM every day
    cron.schedule('0 2 * * *', async () => {
        try {
            console.log('Starting daily scheduled backup...');
            await BackupService.runBackup('daily');
        } catch (error) {
            console.error('Scheduled Daily Backup Failed:', error);
        }
    });

    // 2. Weekly Backup - Runs at 03:00 AM every Sunday
    cron.schedule('0 3 * * 0', async () => {
        try {
            console.log('Starting weekly scheduled backup...');
            await BackupService.runBackup('weekly');
        } catch (error) {
            console.error('Scheduled Weekly Backup Failed:', error);
        }
    });

    // 3. Monthly Backup - Runs at 04:00 AM on the 1st of every month
    cron.schedule('0 4 1 * *', async () => {
        try {
            console.log('Starting monthly scheduled backup...');
            await BackupService.runBackup('monthly');
        } catch (error) {
            console.error('Scheduled Monthly Backup Failed:', error);
        }
    });

    console.log('Backup jobs scheduled successfully.');
};
