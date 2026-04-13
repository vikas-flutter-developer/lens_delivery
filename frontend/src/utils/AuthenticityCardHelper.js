/**
 * AuthenticityCardHelper.js
 * Standardized 85.60mm x 53.98mm Authenticity Card Printing Utility
 */

export const printAuthenticityCard = (transaction, allLenses = [], allItems = []) => {
  const partyName = transaction.partyData?.partyAccount || transaction.partyName || "-";
  const orderDate = new Date(transaction.billData?.date || transaction.createdAt || Date.now()).toLocaleDateString("en-GB");
  const orderNo = transaction.billData?.billNo || transaction.billNo || "-";

  // Group items by Customer Name to create pairs (Right/Left)
  const items = transaction.items || [];
  const groups = {};

  items.forEach((item) => {
    // Some modules use 'customer', 'customerName', 'partyName', or 'Name' field inside item
    const cName = item.customer || item.customerName || item.patientName || item.PatientName || item.partyName || item.PartyName || item.Name || "Customer";
    if (!groups[cName]) {
      groups[cName] = {
        customerName: cName,
        right: null,
        left: null,
        itemName: item.itemName || item.productName || "-",
      };
    }
    
    // Assign to Right or Left based on 'eye' field
    const eye = (item.eye || "").toLowerCase();
    if (eye === "right" || eye === "re" || eye === "r") {
      groups[cName].right = item;
    } else if (eye === "left" || eye === "le" || eye === "l") {
      groups[cName].left = item;
    } else {
      // If eye is not specified, try to fill logically or just put in one
      if (!groups[cName].right) groups[cName].right = item;
      else if (!groups[cName].left) groups[cName].left = item;
    }
  });

  const participantGroups = Object.values(groups);

  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <html>
      <head>
        <title>Authenticity Card - ${orderNo}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
          
          @page {
            size: 85.60mm 53.98mm;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: 'Inter', sans-serif;
            background-color: #f0f0f0;
          }
          .card-wrapper {
            width: 85.60mm;
            height: 53.98mm;
            background: white;
            position: relative;
            overflow: hidden;
            page-break-after: always;
            box-sizing: border-box;
          }
          
          /* FRONT SIDE STYLES */
          .front-side {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 5mm;
            height: 100%;
          }
          .logo-box {
            position: absolute;
            top: 5mm;
            left: 5mm;
            width: 12mm;
            height: 12mm;
            background: black;
            display: flex;
            justify-content: center;
            align-items: center;
            color: white;
            font-weight: 900;
            font-size: 8pt;
          }
          .brand-name {
            font-size: 24pt;
            font-weight: 800;
            margin-top: 5mm;
            color: #000;
            letter-spacing: -0.5mm;
            position: relative;
          }
          .brand-name span {
            font-size: 10pt;
            position: absolute;
            top: 1mm;
            right: -6mm;
          }
          .tagline {
            font-size: 7.5pt;
            font-weight: 600;
            letter-spacing: 0.8mm;
            margin-top: 1.5mm;
            color: #333;
          }
          .footer-title {
            position: absolute;
            bottom: 5mm;
            width: 100%;
            text-align: center;
            font-size: 10.5pt;
            font-weight: 700;
            letter-spacing: 0.5mm;
            color: #1a1a1a;
            text-transform: uppercase;
          }

          /* BACK SIDE STYLES */
          .back-side {
            padding: 3mm 5mm;
            display: flex;
            flex-direction: column;
            font-size: 7.5pt;
            color: #1a1a1a;
            height: 100%;
            box-sizing: border-box;
          }
          .header-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 1.5mm;
            font-weight: 600;
          }
          .info-section {
            margin-bottom: 2mm;
          }
          .info-item {
            margin-bottom: 0.5mm;
          }
          .info-item span:first-child {
            display: inline-block;
            width: 25mm;
            font-weight: 500;
          }
          .info-item span:last-child {
            font-weight: 700;
          }

          .prescription-table {
            width: 100%;
            border-collapse: collapse;
            margin: 1.5mm 0;
            font-size: 7pt;
          }
          .prescription-table th {
            background: #1a1a1a;
            color: white;
            padding: 0.8mm;
            border: 0.1mm solid #1a1a1a;
            text-align: center;
            font-weight: 600;
          }
          .prescription-table td {
            border: 0.2mm solid #1a1a1a;
            padding: 1mm;
            text-align: center;
            font-weight: 700;
            width: 12mm;
          }
          .eye-label {
            text-align: left !important;
            width: 15mm !important;
            padding-left: 1.5mm !important;
            background: #fdfdfd;
            font-weight: 600 !important;
            border: none !important;
          }

          .message-section {
            margin-top: auto;
            border-top: 0.1mm solid #eee;
            padding-top: 1.5mm;
            font-size: 6pt;
            color: #555;
            line-height: 1.25;
          }
          .bullet {
            display: flex;
            margin-bottom: 0.5mm;
          }
          .bullet span:first-child {
            margin-right: 1mm;
          }
        </style>
      </head>
      <body>
        ${participantGroups.map(group => `
          <!-- Front Side -->
          <div class="card-wrapper">
            <div class="front-side">
              <div class="logo-box">
                <svg viewBox="0 0 100 100" width="30" height="30">
                  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="60" font-weight="900" font-family="Arial">ON</text>
                </svg>
              </div>
              <div class="brand-name">
                OptoNova+<span>TM</span>
              </div>
              <div class="tagline">SEE THE WORLD IN HIGH DEFINITION</div>
              <div class="footer-title">CERTIFICATE OF AUTHENTICITY</div>
            </div>
          </div>

          <!-- Back Side -->
          <div class="card-wrapper">
            <div class="back-side">
              <div class="header-row">
                <div>Order no ${orderNo}</div>
                <div>Date ${orderDate}</div>
              </div>

              <div class="info-section">
                <div class="info-item">
                  <span>Customer name</span>
                  <span>${group.customerName || "-"}</span>
                </div>
                <div class="info-item">
                  <span>Optician name</span>
                  <span>${partyName}</span>
                </div>
                <div class="info-item">
                  <span>Item Name:</span>
                  <span>${group.itemName}</span>
                </div>
              </div>

              <table class="prescription-table">
                <thead>
                  <tr>
                    <th style="background:transparent; border:none;"></th>
                    <th>SPH</th>
                    <th>CYL</th>
                    <th>AXIS</th>
                    <th>ADD</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="eye-label">Right</td>
                    <td>${group.right?.sph || "0.00"}</td>
                    <td>${group.right?.cyl || "0.00"}</td>
                    <td>${group.right?.axis || "0"}</td>
                    <td>${group.right?.add || "0.00"}</td>
                  </tr>
                  <tr>
                    <td class="eye-label">Left</td>
                    <td>${group.left?.sph || "0.00"}</td>
                    <td>${group.left?.cyl || "0.00"}</td>
                    <td>${group.left?.axis || "0"}</td>
                    <td>${group.left?.add || "0.00"}</td>
                  </tr>
                </tbody>
              </table>

              <div class="message-section">
                <div class="bullet">
                  <span>•</span>
                  <span>Remember, your eyes should be regularly tested by your eyecare professional.</span>
                </div>
                <div class="bullet">
                  <span>•</span>
                  <span>For queries and assistance, please email us at help@optonovaplus.com</span>
                </div>
                <div class="bullet">
                  <span>•</span>
                  <span>To know more about our lenses, please visit www.optonovaplus.com</span>
                </div>
              </div>
            </div>
          </div>
        `).join("")}

        <script>
          window.onload = function() {
            setTimeout(() => {
              window.print();
              // window.close();
            }, 500);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};
