import ApiClient from "../ApiClient";

/**
 * Validate Account Credit Limit and Day Limit
 * @param {string} accountName - Name of the account
 * @param {number} transactionAmount - Total transaction amount (netAmount)
 * @param {string} orderType - Type of order: "lens", "rx", or "contact"
 * @returns {Promise<{success: boolean, creditLimitValid: boolean, dayLimitValid: boolean, messages: string[]}>}
 */
export const validateAccountLimits = async (accountName, transactionAmount, orderType = "lens") => {
  try {
    if (!accountName || transactionAmount === undefined) {
      console.warn("[VALIDATION] Missing account name or transaction amount", { accountName, transactionAmount });
      return {
        success: false,
        creditLimitValid: true,
        dayLimitValid: true,
        messages: ["Account name and transaction amount are required"]
      };
    }

    // Determine the API endpoint based on order type
    let endpoint = '/lensSaleOrder/validateAccountLimits';
    
    if (orderType === 'rx') {
      endpoint = '/rxSaleOrder/validateAccountLimits';
    } else if (orderType === 'contact') {
      endpoint = '/contactLensSaleOrder/validateAccountLimits';
    }

    const trimmedName = accountName.trim();
    console.log(`[VALIDATION] Validating account: ${trimmedName}, Amount: ₹${transactionAmount}, Endpoint: ${endpoint}`);

    const response = await ApiClient.post(endpoint, {
      accountName: trimmedName,
      transactionAmount: Number(transactionAmount) || 0
    });

    console.log("[VALIDATION] Success response:", response.data);
    return response.data;

  } catch (err) {
    // If response has validation structure, return it (this is expected for validation failures)
    if (err?.response?.data?.hasOwnProperty('success') && err?.response?.data?.hasOwnProperty('creditLimitValid')) {
      console.log("[VALIDATION] Failed response with structure:", err.response.data);
      return err.response.data;
    }
    
    // Handle other errors (e.g., account not found, server error)
    const status = err?.response?.status;
    const errorMessage = err?.response?.data?.message || err?.message || "Error validating account limits";
    const messages = err?.response?.data?.messages || [errorMessage];
    
    console.error(`[VALIDATION] Error (status ${status}):`, { errorMessage, messages, fullError: err?.response?.data });
    
    // If account not found (404) or any error, allow the transaction
    // (validation is not blocking, just warning about limits)
    if (status === 404) {
      console.log("[VALIDATION] Account not found - allowing transaction");
      return {
        success: true,
        creditLimitValid: true,
        dayLimitValid: true,
        messages: []
      };
    }
    
    return {
      success: false,
      creditLimitValid: true,
      dayLimitValid: true,
      messages: Array.isArray(messages) ? messages : [errorMessage]
    };
  }
};

/**
 * Show validation error popup with messages
 * @param {string[]} messages - Array of error messages
 * @returns {string} - Combined message
 */
export const getValidationErrorMessage = (messages = []) => {
  if (!Array.isArray(messages) || messages.length === 0) {
    return "Account validation failed. Please contact administrator.";
  }
  
  if (messages.length === 1) {
    return messages[0];
  }
  
  return messages.join("\n\n");
};
