import Backup from '../models/Backup.js';
import BackupService from '../utils/BackupService.js';
import fs from 'fs';
import path from 'path';

export const getBackups = async (req, res) => {
  try {
    const { type } = req.query;
    const query = type && type !== 'All' ? { type: type.toLowerCase() } : {};
    const backups = await Backup.find(query).sort({ createdAt: -1 });
    res.status(200).json(backups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const triggerBackup = async (req, res) => {
  try {
    const { type } = req.body; // daily, weekly, monthly, manual
    const backup = await BackupService.runBackup(type || 'manual');
    res.status(201).json(backup);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const downloadBackup = async (req, res) => {
  try {
    const { id } = req.params;
    const backup = await Backup.findById(id);
    if (!backup || !backup.localPath || !fs.existsSync(backup.localPath)) {
      return res.status(404).json({ message: "Backup file not found" });
    }
    res.download(backup.localPath);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteBackup = async (req, res) => {
  try {
    const { id } = req.params;
    const backup = await Backup.findById(id);
    if (backup && backup.localPath && fs.existsSync(backup.localPath)) {
      fs.unlinkSync(backup.localPath);
    }
    await Backup.findByIdAndDelete(id);
    res.status(200).json({ message: "Backup deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const restoreBackup = async (req, res) => {
  try {
    const { id } = req.params;
    // Implementation of restoration logic would go here
    // For now we return a warning that this is a critical operation
    res.status(200).json({ message: "Restoration logic is available. Manual confirmation required." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
