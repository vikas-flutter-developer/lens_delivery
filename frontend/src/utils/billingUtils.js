export const getFinancialYearSeries = (prefix = 'S', date = new Date()) => {
    const d = new Date(date);
    const month = d.getMonth() + 1; // 1-indexed
    const year = d.getFullYear();

    let startYear, endYear;

    // Financial Year logic
    if (month >= 1) {
        startYear = year;
        endYear = year + 1;
    } else {
        startYear = year - 1;
        endYear = year;
    }

    const yyStart = String(startYear).slice(-2);
    const yyEnd = String(endYear).slice(-2);

    return `${prefix}(${yyStart}-${yyEnd})`;
};
