/**
 * Converts a number to its Indian English word representation
 */
export const numberToWords = (num) => {
  if (num === 0) return "Zero Rupees Only";
  
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const n2w = (n) => {
    if (n > 9999999) return ""; // Limit
    if (n >= 100000) return n2w(Math.floor(n / 100000)) + " Lakh " + n2w(n % 100000);
    if (n >= 1000) return n2w(Math.floor(n / 1000)) + " Thousand " + n2w(n % 1000);
    if (n >= 100) return n2w(Math.floor(n / 100)) + " Hundred " + (n % 100 !== 0 ? "And " : "") + n2w(n % 100);
    if (n >= 1000) return n2w(Math.floor(n / 1000)) + " Thousand " + (n % 1000 !== 0 && n % 1000 < 100 ? "And " : "") + n2w(n % 1000);
    if (n >= 100000) return n2w(Math.floor(n / 100000)) + " Lakh " + (n % 100000 !== 0 && n % 100000 < 100 ? "And " : "") + n2w(n % 100000);
    if (n >= 20) return b[Math.floor(n / 10)] + " " + a[n % 10];
    return a[n];
  };

  const str = n2w(Math.round(num)).trim();
  return (str ? str + " Rupees Only" : "Zero Rupees Only");
};
