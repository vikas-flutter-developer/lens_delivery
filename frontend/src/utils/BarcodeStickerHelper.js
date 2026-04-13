/**
 * Standardized Barcode Sticker Helper
 * Generates HTML for 70mm x 30mm barcode stickers
 */

export const generateStandardBarcodeStickerHTML = (transaction, allLenses = [], allItems = [], isPurchase = false) => {
  const partyName = (transaction?.partyData?.partyAccount || "Unknown Party").toUpperCase();
  const orderNo = transaction?.billData?.billNo || "-";
  
  // Format Date to DD-MM-YYYY
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "-";
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };
  
  const orderDate = formatDate(transaction?.billData?.date || transaction?.createdAt);

  const getPrintItemName = (item) => {
    if (item.billItemName && item.billItemName.trim() !== "") return item.billItemName;
    const foundLens = (allLenses || []).find(l => 
      String(l.productName || "").toLowerCase() === String(item.itemName || "").toLowerCase()
    );
    if (foundLens?.billItemName) return foundLens.billItemName;
    const foundItem = (allItems || []).find(i => 
      String(i.itemName || "").toLowerCase() === String(item.itemName || "").toLowerCase()
    );
    if (foundItem?.billItemName) return foundItem.billItemName;
    return item.itemName || "-";
  };

  const stickersHTML = (transaction.items || [])
    .filter(item => (Number(item.qty) || 0) > 0)
    .map((item, i) => {
      const itemName = getPrintItemName(item);
      const barcodeNo = item.barcode || "0000000";
      const eyeValue = item.eye || "";
      const qrData = isPurchase ? barcodeNo : itemName;
      const partyNameHTML = isPurchase ? "" : `<div class="party-name">${partyName}</div>`;
      
      return `
        <div class="sticker-container">
          <!-- Left Section: Eye, QR, Barcode No -->
          <div class="left-section">
            <div class="qr-container" style="margin-top: 2.5mm;">
              <img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrData)}&size=60x60" alt="QR" />
            </div>
            <div class="barcode-no">${barcodeNo}</div>
          </div>
          
          <!-- Right Section: Party, Item, Power, Footer -->
          <div class="right-section ${isPurchase ? 'purchase-mode' : ''}">
            ${partyNameHTML}
            <div class="item-name">${itemName}</div>
            <table class="power-table">
              <thead>
                <tr>
                  <th>EYE</th>
                  <th>SPH</th>
                  <th>CYL</th>
                  <th>AXIS</th>
                  <th>ADD</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${eyeValue}</td>
                  <td>${item.sph || "0.00"}</td>
                  <td>${item.cyl || "0.00"}</td>
                  <td>${item.axis || "0"}</td>
                  <td>${item.add || "0.00"}</td>
                </tr>
              </tbody>
            </table>
            <div class="footer-row">
              <div class="order-no">${isPurchase ? '' : 'Order No : '}${orderNo}</div>
              <div class="date-val">${isPurchase ? '' : 'Date : '}${orderDate}</div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <html>
      <head>
        <title>Standard Barcode stickers (70x30mm)</title>
        <style>
          @page {
            size: 70mm 30mm;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #fff;
          }
          .sticker-container {
            width: 70mm;
            height: 30mm;
            padding: 1mm 2mm;
            box-sizing: border-box;
            display: flex;
            page-break-after: always;
            position: relative;
            overflow: hidden;
          }
          .left-section {
            width: 22mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            padding-right: 1.5mm;
            border-right: 0.1mm solid #eee;
          }
          .eye-val {
            font-size: 10pt;
            font-weight: 900;
            height: 4mm;
            line-height: 4mm;
            text-align: center;
          }
          .qr-container {
            width: 14mm;
            height: 14mm;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .qr-container img {
            width: 13mm;
            height: 13mm;
          }
          .barcode-no {
            font-size: 6.5pt;
            font-weight: bold;
            letter-spacing: -0.1mm;
            height: 4mm;
            line-height: 4mm;
            text-align: center;
            overflow: hidden;
            white-space: nowrap;
          }
          .right-section {
            flex: 1;
            padding-left: 2mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .party-name {
            font-size: 8pt;
            font-weight: 900;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-top: 1mm;
          }
          .item-name {
            font-size: 7.5pt;
            font-weight: 600;
            line-height: 1.1;
            margin-top: 0.5mm;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            height: 6.5mm;
          }
          .power-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 0.8mm;
            font-size: 6.8pt;
          }
          .power-table th {
            background: #1a1a1a;
            color: white;
            font-weight: 800;
            padding: 0.5mm 0.2mm;
            text-align: center;
            font-size: 5.5pt;
            border: 0.1mm solid #1a1a1a;
          }
          .power-table td {
            border: 0.2mm solid #1a1a1a;
            text-align: center;
            font-weight: 900;
            padding: 0.8mm 0.2mm;
            color: #000;
          }
          .footer-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 7pt;
            font-weight: 700;
            margin-bottom: 0.5mm;
            border-top: 0.1mm solid #eee;
            padding-top: 0.5mm;
          }
          
          /* Purchase Mode Overrides */
          .purchase-mode {
            padding-top: 1mm;
          }
          .purchase-mode .item-name {
            font-size: 9.5pt;
            font-weight: 900; /* Bolder */
            margin-bottom: 1mm;
          }
          .purchase-mode .power-table th {
            font-size: 6pt;
          }
          .purchase-mode .power-table td {
            font-size: 8.5pt;
            padding: 1.2mm 0.2mm;
          }
          .purchase-mode .footer-row {
            font-size: 8.5pt;
            padding-top: 1mm;
            font-weight: 800;
          }
        </style>
      </head>
      <body>
        ${stickersHTML}
        <script>
          window.onload = function() {
            setTimeout(() => {
              window.print();
              window.close();
            }, 500);
          };
        </script>
      </body>
    </html>
  `;
};

export const printBarcodeStickers = (transaction, allLenses = [], allItems = [], isPurchase = false) => {
  const html = generateStandardBarcodeStickerHTML(transaction, allLenses, allItems, isPurchase);
  const printWindow = window.open("", "_blank", "width=800,height=600");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
};
