import ApiClient from "../ApiClient";

export const getAccountLedger = async (params = {}) => {
  try {
    const res = await ApiClient.post("/ledger/account-ledger", params);
    return res.data; // { success, count, data }
  } catch (err) {
    // rethrow so callers can handle
    throw err;
  }
};
export const reconcileLedgerTransactions = async (data = {}) => {
  try {
    const res = await ApiClient.post("/ledger/reconcile-transactions", data);
    return res.data;
  } catch (err) {
    throw err;
  }
};
