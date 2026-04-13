import ShortcutKey from '../models/ShortcutKey.js';

const defaultShortcuts = [
  { pageName: 'Account Master', module: 'Masters', shortcutKey: 'Alt+Shift+A', url: '/masters/accountmaster/accountmaster', description: 'Quick access to Account Master' },
  { pageName: 'Group, Item & Lens Creation', module: 'Masters', shortcutKey: 'Alt+Shift+I', url: '/masters/inventorymaster/creation', description: 'Create new items and lenses' },
  { pageName: 'Lens Price', module: 'Masters', shortcutKey: 'Alt+Shift+L', url: '/masters/inventorymaster/lensprice', description: 'View and manage lens prices' },
  { pageName: 'Add Voucher', module: 'Transaction', shortcutKey: 'Alt+Shift+V', url: '/transaction/payrecptumicntr/addvoucher', description: 'Add new payment/receipt voucher' },
  { pageName: 'Sale Invoice', module: 'Sale', shortcutKey: 'Alt+Shift+S', url: '/lenstransaction/sale/saleinvoice', description: 'Create sale invoice' },
  { pageName: 'Sale Order', module: 'Sale', shortcutKey: 'Ctrl+Alt+S', url: '/lenstransaction/sale/saleorder', description: 'Manage sale orders' },
  { pageName: 'Sale Challan', module: 'Sale', shortcutKey: 'Alt+Shift+C', url: '/lenstransaction/sale/salechallan', description: 'Manage sale challans' },
  { pageName: 'Sale Return', module: 'Sale', shortcutKey: 'Ctrl+Alt+R', url: '/lenstransaction/salereturn', description: 'Manage sale returns' },
  { pageName: 'Purchase Invoice', module: 'Purchase', shortcutKey: 'Alt+Shift+P', url: '/lenstransaction/purchase/purchaseinvoice', description: 'Create purchase invoice' },
  { pageName: 'Purchase Order', module: 'Purchase', shortcutKey: 'Ctrl+Alt+P', url: '/lenstransaction/purchase/purchaseorder', description: 'Manage purchase orders' },
  { pageName: 'Purchase Challan', module: 'Purchase', shortcutKey: 'Alt+Shift+H', url: '/lenstransaction/purchase/purchasechallan', description: 'Manage purchase challans' },
  { pageName: 'Purchase Return', module: 'Purchase', shortcutKey: 'Ctrl+Alt+U', url: '/lenstransaction/purchasereturn', description: 'Manage purchase returns' },
];

const normalizeKey = (key) => key.trim().replace(/\s+/g, '');

export const getShortcuts = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`Fetching shortcuts for user: ${userId}`);
    let shortcuts = await ShortcutKey.find({ user: userId });

    if (shortcuts.length === 0) {
      console.log(`No shortcuts found for user ${userId}, initializing defaults.`);
      const shortcutsToCreate = defaultShortcuts.map(s => ({ ...s, user: userId }));
      shortcuts = await ShortcutKey.insertMany(shortcutsToCreate);
    }

    res.status(200).json(shortcuts);
  } catch (error) {
    console.error(`Error in getShortcuts: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

export const createShortcut = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pageName, module, shortcutKey, description, status, url } = req.body;
    
    const normalizedKey = normalizeKey(shortcutKey);

    // Check for conflicts
    const conflict = await ShortcutKey.findOne({ user: userId, shortcutKey: normalizedKey });
    if (conflict) {
      return res.status(409).json({ message: `Shortcut ${normalizedKey} is already assigned to ${conflict.pageName}` });
    }

    const newShortcut = new ShortcutKey({
      user: userId,
      pageName,
      module,
      shortcutKey: normalizedKey,
      description,
      status,
      url
    });

    await newShortcut.save();
    res.status(201).json(newShortcut);
  } catch (error) {
    console.error(`Error in createShortcut: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

export const updateShortcut = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { pageName, module, shortcutKey, description, status, url } = req.body;

    const normalizedKey = normalizeKey(shortcutKey);

    // Check for conflicts with other shortcuts
    const conflict = await ShortcutKey.findOne({ 
      user: userId, 
      shortcutKey: normalizedKey, 
      _id: { $ne: id } 
    });
    
    if (conflict) {
      return res.status(409).json({ message: `Shortcut ${normalizedKey} is already assigned to ${conflict.pageName}` });
    }

    const updatedShortcut = await ShortcutKey.findOneAndUpdate(
      { _id: id, user: userId },
      { pageName, module, shortcutKey: normalizedKey, description, status, url },
      { new: true }
    );

    if (!updatedShortcut) {
      return res.status(404).json({ message: "Shortcut not found" });
    }

    res.status(200).json(updatedShortcut);
  } catch (error) {
    console.error(`Error in updateShortcut for ID ${id}: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

export const deleteShortcut = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const deletedShortcut = await ShortcutKey.findOneAndDelete({ _id: id, user: userId });

    if (!deletedShortcut) {
      return res.status(404).json({ message: "Shortcut not found" });
    }

    res.status(200).json({ message: "Shortcut deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const resetToDefaults = async (req, res) => {
  try {
    const userId = req.user.id;

    // Delete existing shortcuts
    await ShortcutKey.deleteMany({ user: userId });

    // Insert defaults
    const shortcutsToCreate = defaultShortcuts.map(s => ({ ...s, user: userId }));
    const shortcuts = await ShortcutKey.insertMany(shortcutsToCreate);

    res.status(200).json(shortcuts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
