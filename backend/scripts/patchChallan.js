const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/controllers/LensPurchaseOrder.controller.js');
let content = fs.readFileSync(file, 'utf8');

// Find the boundaries of the function to replace
const startMarker = 'const createLensPurchaseChallan = async (req, res) => {';
const endMarker = 'const updatePurchaseOrderStatus = async (req, res) => {';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find markers. startIdx:', startIdx, 'endIdx:', endIdx);
    process.exit(1);
}

const newFunc = `const createLensPurchaseChallan = async (req, res) => {
  try {
    let data = req.body || {};

    // Auto-fetch if only orderId is provided (e.g. from Postman)
    if (data.orderId && (!data.items || data.items.length === 0)) {
      let sourceOrder;
      try {
        sourceOrder = await LensPurchaseOrder.findById(data.orderId);
      } catch (e) {
        return res.status(400).json({ success: false, message: 'Invalid orderId: ' + e.message });
      }
      if (!sourceOrder) {
        return res.status(404).json({ success: false, message: 'Source order not found for orderId: ' + data.orderId });
      }

      const unchallanedItems = sourceOrder.items
        .filter((item) => !item.isChallaned)
        .map(item => (item.toObject ? item.toObject() : Object.assign({}, item)));

      console.log('[createLensPurchaseChallan] orderId:', data.orderId, '| total items:', sourceOrder.items.length, '| unchallaned:', unchallanedItems.length);

      if (!unchallanedItems.length) {
        return res.status(400).json({ success: false, message: 'All items in this order are already challaned.' });
      }

      data = Object.assign({}, data, {
        sourcePurchaseId: data.orderId,
        billData: sourceOrder.billData,
        partyData: sourceOrder.partyData,
        taxes: sourceOrder.taxes || [],
        grossAmount: sourceOrder.grossAmount,
        subtotal: sourceOrder.subtotal,
        taxesAmount: sourceOrder.taxesAmount,
        netAmount: sourceOrder.netAmount,
        paidAmount: sourceOrder.paidAmount,
        dueAmount: sourceOrder.dueAmount,
        deliveryDate: sourceOrder.deliveryDate,
        remark: sourceOrder.remark,
        status: sourceOrder.status,
        items: unchallanedItems,
        selectedItemIds: unchallanedItems.map((item) => String(item._id)),
      });
    }

    const selectedItemIds = (data.selectedItemIds || []).map(String);
    const rawItems = data.items || [];

    // Filter by selectedItemIds if provided, otherwise include all items
    const filteredItems = selectedItemIds.length > 0
      ? rawItems.filter((item) => selectedItemIds.includes(String(item._id)))
      : rawItems;

    const items = filteredItems.map((item) => ({
      _id: item._id ? String(item._id) : undefined,
      barcode: item.barcode || '',
      itemName: item.itemName || '',
      unit: item.unit || '',
      dia: item.dia || '',
      eye: item.eye || '',
      sph: Number(item.sph) || 0,
      cyl: Number(item.cyl) || 0,
      axis: Number(item.axis) || 0,
      add: Number(item.add) || 0,
      qty: Number(item.qty) || 0,
      purchasePrice: Number(item.purchasePrice) || 0,
      discount: Number(item.discount) || 0,
      totalAmount: Number(item.totalAmount) || 0,
      sellPrice: Number(item.sellPrice) || 0,
      combinationId: item.combinationId || '',
      orderNo: item.orderNo || '',
      remark: item.remark || '',
      isChallaned: true,
      itemStatus: 'In Progress',
    }));

    const taxes = (data.taxes || []).map((tax) => ({
      taxName: tax.taxName || '',
      type: tax.type || 'Additive',
      percentage: Number(tax.percentage) || 0,
      amount: Number(tax.amount) || 0,
      meta: tax.meta || {},
    }));

    console.log('[createLensPurchaseChallan] items to challan:', items.length);

    if (!items.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one challan item is required',
      });
    }

    const subtotal = items.reduce((s, it) => s + (Number(it.totalAmount) || 0), 0);
    const taxesAmount = taxes.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const netAmount = subtotal + taxesAmount;
    const paidAmount = Number(data.paidAmount) || 0;
    const dueAmount = netAmount - paidAmount;
    const grossAmount = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.purchasePrice) || 0), 0);

    for (const it of items) {
      if (Number(it.qty) > 0) {
        try {
          let combId = it.combinationId;
          if (!combId) {
            const lookup = await LensGroup.findOne({ productName: it.itemName });
            if (lookup && lookup.addGroups) {
              const ag = lookup.addGroups.find(g => Number(g.addValue) === Number(it.add || 0));
              if (ag && ag.combinations) {
                const matchedComb = ag.combinations.find(c =>
                  Number(c.sph) === Number(it.sph || 0) &&
                  Number(c.cyl) === Number(it.cyl || 0) &&
                  (it.eye === 'RL' ? (c.eye === 'R' || c.eye === 'L' || c.eye === 'RL') : c.eye === it.eye)
                );
                if (matchedComb) combId = matchedComb._id;
              }
            }
          }
          if (!combId) { console.warn('skipping stock increase: combinationId missing for', it.itemName); continue; }
          const resolvedId = new mongoose.Types.ObjectId(combId);
          const parent = await LensGroup.findOne({ 'addGroups.combinations._id': resolvedId });
          if (!parent) { continue; }
          let matched = null;
          for (const ag of parent.addGroups) {
            const comb = ag.combinations.id(resolvedId);
            if (comb) { matched = comb; break; }
          }
          if (!matched) { continue; }
          matched.initStock = Number(matched.initStock || 0) + Number(it.qty || 0);
          await parent.save();
        } catch (err) {
          console.error('Error increasing stock for', it.itemName, ':', err.message);
          continue;
        }
      }
    }

    const challanBillData = {
      billSeries: data.billData && data.billData.billSeries || '',
      billNo: data.billData && data.billData.billNo || '',
      billType: data.billData && data.billData.billType || '',
      godown: data.billData && data.billData.godown || '',
      bookedBy: data.billData && data.billData.bookedBy || '',
      date: (data.billData && data.billData.date) || new Date(),
    };

    const newChallan = new LensPurchaseChallan({
      billData: challanBillData,
      partyData: data.partyData || {},
      items,
      taxes,
      grossAmount,
      subtotal,
      taxesAmount,
      netAmount,
      paidAmount,
      dueAmount,
      deliveryDate: data.deliveryDate || Date.now(),
      time: new Date().toLocaleTimeString('en-IN'),
      remark: data.remark || '',
      status: derivePurchaseOrderStatus(items, 'In Progress'),
      parentStatus: derivePurchaseOrderStatus(items, 'In Progress'),
      sourcePurchaseId: data.sourcePurchaseId || null,
      orderType: 'LENS',
    });

    const savedChallan = await newChallan.save();

    if (data.sourcePurchaseId && items.length) {
      try {
        const order = await LensPurchaseOrder.findById(data.sourcePurchaseId);
        if (order) {
          let addedUsedQty = 0;
          for (const invItem of items) {
            if (!invItem._id) continue;
            const sItem = order.items.id(invItem._id);
            if (sItem && !sItem.isChallaned) {
              sItem.isChallaned = true;
              const qtyUsed = Number(invItem.qty) || 0;
              order.usageHistory.push({
                challanId: savedChallan._id.toString(),
                billNo: savedChallan.billData.billNo || '',
                series: savedChallan.billData.billSeries || '',
                qtyUsed,
                date: new Date(),
              });
              addedUsedQty += qtyUsed;
            }
          }
          order.usedQty = Number(order.usedQty || 0) + addedUsedQty;
          const itemsTotalQty = Array.isArray(order.items) ? order.items.reduce((s, it) => s + (Number(it.qty) || 0), 0) : 0;
          order.orderQty = Number(order.orderQty != null ? order.orderQty : itemsTotalQty);
          order.balQty = Math.max(0, Number(order.orderQty || 0) - Number(order.usedQty || 0));
          order.items = order.items.map(sItem => {
            if (selectedItemIds.includes(String(sItem._id))) {
              sItem.itemStatus = 'In Progress';
              sItem.isChallaned = true;
            }
            return sItem;
          });
          order.status = derivePurchaseOrderStatus(order.items, order.status);
          order.parentStatus = order.status;
          if (!order.usedIn) order.usedIn = [];
          if (!order.usedIn.some(u => u.type === 'PC' && u.number === savedChallan.billData.billNo)) {
            order.usedIn.push({ type: 'PC', number: savedChallan.billData.billNo });
          }
          await order.save();
        }
      } catch (err) {
        console.warn('Could not update selected items challan flags:', err.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Challan created successfully',
      data: savedChallan,
    });
  } catch (err) {
    console.error('Error creating lens challan:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create challan',
      error: err.message,
    });
  }
};

`;

const newContent = content.slice(0, startIdx) + newFunc + content.slice(endIdx);
fs.writeFileSync(file, newContent, 'utf8');
console.log('SUCCESS: File patched. Characters replaced:', endIdx - startIdx);
