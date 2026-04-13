import ApiClient from "../ApiClient";

export const getLensStockReport = async (filters) => {
    try {
        const response = await ApiClient.post('/reports/lensstock', filters);
        return response.data;
    } catch (error) {
        console.error('Error fetching lens stock report:', error);
        throw error;
    }
};

export const getPartyWiseItemReport = async (filters) => {
    try {
        const response = await ApiClient.post('/reports/partywiseitem', filters);
        return response.data;
    } catch (error) {
        console.error('Error fetching party wise item report:', error);
        throw error;
    }
};
export const getLensMovementReport = async (filters) => {
    try {
        const response = await ApiClient.post('/reports/lensmovement', filters);
        return response.data;
    } catch (error) {
        console.error('Error fetching lens movement report:', error);
        throw error;
    }
};

export const getDayBookReport = async (filters) => {
    try {
        const response = await ApiClient.post('/reports/daybook', filters);
        return response.data;
    } catch (error) {
        console.error('Error fetching day book report:', error);
        throw error;
    }
};

export const getCashBankBookReport = async (filters) => {
    try {
        const response = await ApiClient.post('/reports/cashbankbook', filters);
        return response.data;
    } catch (error) {
        console.error('Error fetching cash/bank book report:', error);
        throw error;
    }
};

export const getProfitAndLossReport = async (filters) => {
    try {
        const response = await ApiClient.post('/reports/profitloss', filters);
        return response.data;
    } catch (error) {
        console.error('Error fetching profit and loss report:', error);
        throw error;
    }
};

export const getParentGroups = async () => {
    try {
        const response = await ApiClient.get('/reports/parentgroups');
        return response.data;
    } catch (error) {
        console.error('Error fetching parent groups:', error);
        throw error;
    }
};

export const getBankAccounts = async () => {
    try {
        const response = await ApiClient.get('/reports/bankaccounts');
        return response.data;
    } catch (error) {
        console.error('Error fetching bank accounts:', error);
        throw error;
    }
};

export const getProfitAndLossAccountReport = async (filters) => {
    try {
        const response = await ApiClient.post('/reports/profitlossaccount', filters);
        return response.data;
    } catch (error) {
        console.error('Error fetching profit and loss account report:', error);
        throw error;
    }
};

export const getTransactionSummaryReport = async (filters) => {
    try {
        const response = await ApiClient.post('/reports/transactionsummary', filters);
        return response.data;
    } catch (error) {
        console.error('Error fetching transaction summary report:', error);
        throw error;
    }
};

export const getTransactionDetailReport = async (filters) => {
    try {
        const response = await ApiClient.post('/reports/transactiondetail', filters);
        return response.data;
    } catch (error) {
        console.error('Error fetching transaction detail report:', error);
        throw error;
    }
};

export const getSaleSummaryFormatReport = async (filters) => {
    try {
        const response = await ApiClient.post('/reports/salesummaryformat', filters);
        return response.data;
    } catch (error) {
        console.error('Error fetching sale summary format report:', error);
        throw error;
    }
};

export const getBalanceSheetReport = async (filters) => {
    try {
        const response = await ApiClient.post('/reports/balancesheet', filters);
        return response.data;
    } catch (error) {
        console.error('Error fetching balance sheet report:', error);
        throw error;
    }
};

export const getCollectionReport = async (filters) => {
    try {
        const response = await ApiClient.post('/reports/collection', filters);
        return response.data;
    } catch (error) {
        console.error('Error fetching collection report:', error);
        throw error;
    }
};

export const getSaleItemGroupWiseReport = async (filters) => {
    try {
        const response = await ApiClient.post('/reports/saleitemgroupwise', filters);
        return response.data;
    } catch (error) {
        console.error('Error fetching sale item group wise report:', error);
        throw error;
    }
};

export const getCustomerAnalysisReport = async (filters) => {
    try {
        const response = await ApiClient.post('/reports/customeranalysis', filters);
        return response.data;
    } catch (error) {
        console.error('Error fetching customer analysis report:', error);
        throw error;
    }
};

export const getPowerMovementReport = async (filters) => {
    try {
        const response = await ApiClient.post('/reports/powermovement', filters);
        return response.data;
    } catch (error) {
        console.error('Error fetching power movement report:', error);
        throw error;
    }
};
export const getBankVerificationTransactions = async (filters) => {
    try {
        const response = await ApiClient.post('/reports/bank-verification', filters);
        return response.data;
    } catch (error) {
        console.error('Error fetching bank verification data:', error);
        throw error;
    }
};

export const getItemStockSummaryReport = async (filters) => {
    try {
        const response = await ApiClient.post('/reports/itemstocksummary', filters);
        return response.data;
    } catch (error) {
        console.error('Error fetching item stock summary report:', error);
        throw error;
    }
};

export const getSalesGrowthComparisonReport = async (filters) => {
    try {
        const response = await ApiClient.post('/reports/salesgrowth', filters);
        return response.data;
    } catch (error) {
        console.error('Error fetching sales growth comparison report:', error);
        throw error;
    }
};


