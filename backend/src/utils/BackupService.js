import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import mongoose from 'mongoose';
import Backup from '../models/Backup.js';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

class BackupService {
  constructor() {
    this.backupDir = path.join(process.cwd(), 'backups');
    this.ensureDirectoryExists(this.backupDir);
    this.ensureDirectoryExists(path.join(this.backupDir, 'daily'));
    this.ensureDirectoryExists(path.join(this.backupDir, 'weekly'));
    this.ensureDirectoryExists(path.join(this.backupDir, 'monthly'));
    this.ensureDirectoryExists(path.join(this.backupDir, 'manual'));
    this.ensureDirectoryExists(path.join(this.backupDir, 'temp'));
  }

  ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async runBackup(type = 'manual') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup_${type}_${timestamp}`;
    const tempPath = path.join(this.backupDir, 'temp', backupName);
    const zipPath = path.join(this.backupDir, type, `${backupName}.zip`);
    
    this.ensureDirectoryExists(tempPath);
    
    const backupRecord = new Backup({
      name: backupName,
      type,
      status: 'pending',
      localPath: zipPath
    });
    await backupRecord.save();

    try {
      console.log(`Starting backup: ${backupName}`);
      
      // 1. Backup Database
      await this.dumpDatabase(tempPath);
      
      // 2. Backup Files (Uploads)
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (fs.existsSync(uploadsDir)) {
          // We will handle directory copy or just direct zip
      }

      // 3. Zip everything
      await this.zipDirectory(tempPath, zipPath, uploadsDir);
      
      // 4. Get file size
      const stats = fs.statSync(zipPath);
      backupRecord.size = stats.size;
      backupRecord.status = 'completed';
      
      // 5. Cloud Upload (Optional - check env)
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        try {
          const cloudUrl = await this.uploadToCloud(zipPath, `${type}/${backupName}.zip`);
          backupRecord.storageLocation = 'cloud';
          backupRecord.cloudPath = cloudUrl;
        } catch (cloudErr) {
          console.error('Cloud upload failed:', cloudErr);
          // Don't fail the whole backup if cloud upload fails, just log it
        }
      }

      await backupRecord.save();
      
      // 6. Cleanup temp
      fs.rmSync(tempPath, { recursive: true, force: true });
      
      // 7. Cleanup old backups according to retention policy
      await this.cleanupOldBackups(type);
      
      console.log(`Backup completed successfully: ${backupName}`);
      return backupRecord;
    } catch (error) {
      console.error(`Backup failed: ${backupName}`, error);
      backupRecord.status = 'failed';
      backupRecord.error = error.message;
      await backupRecord.save();
      
      // Cleanup temp
      if (fs.existsSync(tempPath)) {
        fs.rmSync(tempPath, { recursive: true, force: true });
      }
      throw error;
    }
  }

  async dumpDatabase(targetPath) {
    const dbPath = path.join(targetPath, 'database');
    this.ensureDirectoryExists(dbPath);
    
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database not connected. Current state: ' + mongoose.connection.readyState);
    }

    const db = mongoose.connection.db;
    if (!db) {
        throw new Error('Mongoose connection.db is undefined');
    }

    const collections = await db.listCollections().toArray();
    console.log(`Dumping ${collections.length} collections...`);
    
    for (const collection of collections) {
      const name = collection.name;
      // Skip system collections
      if (name.startsWith('system.')) continue;
      
      console.log(`Dumping collection: ${name}`);
      const data = await db.collection(name).find({}).toArray();
      fs.writeFileSync(path.join(dbPath, `${name}.json`), JSON.stringify(data, null, 2));
    }
  }

  async zipDirectory(sourcePath, outPath, uploadsDir) {
    return new Promise((resolve, reject) => {
      console.log(`Creating zip archive at: ${outPath}`);
      const output = fs.createWriteStream(outPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        console.log(`Archive finalized. Total size: ${archive.pointer()} bytes`);
        resolve();
      });
      
      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          console.warn('Archiver warning:', err);
        } else {
          reject(err);
        }
      });

      archive.on('error', (err) => {
        console.error('Archiver error:', err);
        reject(err);
      });

      archive.pipe(output);
      
      // Add database dump
      console.log('Adding database dump to archive...');
      archive.directory(sourcePath, 'database');
      
      // Add uploads if they exist
      if (uploadsDir && fs.existsSync(uploadsDir)) {
        console.log('Adding uploads directory to archive...');
        archive.directory(uploadsDir, 'uploads');
      }
      
      // Add environment variables
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        console.log('Adding .env file to archive...');
        archive.file(envPath, { name: '.env' });
      }

      archive.finalize();
    });
  }

  async uploadToCloud(filePath, cloudKey) {
    const client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
      endpoint: process.env.AWS_S3_ENDPOINT || undefined // For S3 compatible services
    });

    const fileStream = fs.createReadStream(filePath);
    const bucket = process.env.AWS_S3_BUCKET;

    const upload = new Upload({
      client,
      params: {
        Bucket: bucket,
        Key: cloudKey,
        Body: fileStream,
      },
    });

    await upload.done();
    return `s3://${bucket}/${cloudKey}`;
  }

  async cleanupOldBackups(type) {
    const retention = {
      daily: 7,
      weekly: 4,
      monthly: 12,
      manual: 10 // Limit manual backups too
    };

    const limit = retention[type] || 5;
    const oldBackups = await Backup.find({ type, status: 'completed' })
      .sort({ createdAt: -1 })
      .skip(limit);

    for (const backup of oldBackups) {
      if (backup.localPath && fs.existsSync(backup.localPath)) {
        fs.unlinkSync(backup.localPath);
      }
      // You might also want to delete from cloud if you have a policy for that
      await Backup.findByIdAndDelete(backup._id);
    }
  }

  async restoreBackup(backupId) {
    const backup = await Backup.findById(backupId);
    if (!backup || backup.status !== 'completed') {
      throw new Error('Valid backup not found');
    }

    // Logic for restoration...
    // This is high risk, we should probably have a dedicated worker or handle it very carefully.
    // 1. Unzip to temp
    // 2. Iterate through files and restore database
    // 3. Restore files
    // For now, I'll provide the UI and the placeholder for restoration.
    return { message: 'Restoration logic initialized' };
  }
}

export default new BackupService();
