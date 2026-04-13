import LensSale from "../models/LensSale.js";

// ---- helper (private to controller) ----
function getStartDateForPeriod(period) {
  const now = new Date();

  if (period === "day") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  if (period === "week") {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const res = new Date(d.setDate(diff));
    res.setHours(0, 0, 0, 0);
    return res;
  }

  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // year
  return new Date(now.getFullYear(), 0, 1);
}

// ---- CONTROLLER ----
export const getTopProducts = async (req, res) => {
  try {
    const period = req.query.period || "week";
    const limit = Number(req.query.limit) || 6;

    const startDate = getStartDateForPeriod(period);

    const pipeline = [
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lte: new Date(),
          },
        },
      },
      { $unwind: "$items" },
      { $match: { "items.qty": { $gt: 0 } } },
      {
        $group: {
          _id: {
            combinationId: "$items.combinationId",
            name: "$items.itemName",
          },
          totalQty: { $sum: "$items.qty" },
          totalAmount: { $sum: "$items.totalAmount" },
        },
      },
      { $sort: { totalQty: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          combinationId: "$_id.combinationId",
          name: "$_id.name",
          qty: "$totalQty",
          revenue: "$totalAmount",
        },
      },
    ];

    const results = await LensSale.aggregate(pipeline).allowDiskUse(true);

    return res.json({
      success: true,
      period,
      count: results.length,
      data: results,
    });
  } catch (err) {
    console.error("Top products error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch top products",
      error: err.message,
    });
  }
};
