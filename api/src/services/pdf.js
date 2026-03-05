/**
 * PDF export service using PDFKit.
 * Generates PDF reports for transactions, budgets, and net worth.
 */

// Dynamic import to handle optional dependency gracefully
let PDFDocument;
try {
    const mod = await import('pdfkit');
    PDFDocument = mod.default;
} catch {
    PDFDocument = null;
}

const COLORS = {
    primary: '#6366f1',
    dark: '#1e293b',
    gray: '#64748b',
    lightGray: '#e2e8f0',
    green: '#22c55e',
    red: '#ef4444',
    white: '#ffffff',
    bg: '#f8fafc'
};

function addHeader(doc, title, subtitle) {
    doc.fontSize(20).fillColor(COLORS.primary).text('Oasis Budget', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(16).fillColor(COLORS.dark).text(title);
    if (subtitle) {
        doc.fontSize(10).fillColor(COLORS.gray).text(subtitle);
    }
    doc.moveDown(0.5);
    doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .strokeColor(COLORS.lightGray).stroke();
    doc.moveDown(0.5);
}

function addPageNumber(doc) {
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor(COLORS.gray)
            .text(`Page ${i + 1} of ${pages.count}`, 50, doc.page.height - 40, { align: 'center' });
    }
}

function drawTableRow(doc, columns, y, widths, options = {}) {
    const { bold = false, bgColor = null, textColor = COLORS.dark } = options;
    const startX = doc.x || 50;
    let x = startX;

    if (bgColor) {
        const totalWidth = widths.reduce((s, w) => s + w, 0);
        doc.rect(startX - 5, y - 3, totalWidth + 10, 18).fill(bgColor);
    }

    doc.fontSize(bold ? 9 : 8).fillColor(textColor);
    if (bold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');

    for (let i = 0; i < columns.length; i++) {
        const text = String(columns[i] ?? '');
        doc.text(text, x, y, { width: widths[i], ellipsis: true });
        x += widths[i];
    }

    return y + 18;
}

/**
 * Generate a PDF of transactions.
 */
export function generateTransactionsPDF(transactions, filters = {}) {
    if (!PDFDocument) throw new Error('pdfkit not installed. Run: npm install pdfkit');

    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const chunks = [];

    return new Promise((resolve, reject) => {
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const subtitle = [
            filters.from && `From: ${filters.from}`,
            filters.to && `To: ${filters.to}`,
            filters.account && `Account: ${filters.account}`
        ].filter(Boolean).join(' | ') || `Generated: ${new Date().toLocaleDateString()}`;

        addHeader(doc, 'Transaction Report', subtitle);

        // Summary
        const totalIncome = transactions.filter(t => t.amount > 0).reduce((s, t) => s + parseFloat(t.amount), 0);
        const totalExpenses = transactions.filter(t => t.amount < 0).reduce((s, t) => s + parseFloat(t.amount), 0);

        doc.fontSize(10).fillColor(COLORS.dark);
        doc.text(`Total Transactions: ${transactions.length}    |    `, { continued: true });
        doc.fillColor(COLORS.green).text(`Income: $${totalIncome.toFixed(2)}    |    `, { continued: true });
        doc.fillColor(COLORS.red).text(`Expenses: $${Math.abs(totalExpenses).toFixed(2)}`);
        doc.moveDown();

        // Table
        const widths = [65, 90, 75, 85, 80, 60, 40];
        let y = drawTableRow(doc, ['Date', 'Payee', 'Category', 'Account', 'Memo', 'Amount', 'Clr'], doc.y, widths, { bold: true, bgColor: COLORS.lightGray });

        for (const txn of transactions) {
            if (y > doc.page.height - 80) {
                doc.addPage();
                y = 50;
                y = drawTableRow(doc, ['Date', 'Payee', 'Category', 'Account', 'Memo', 'Amount', 'Clr'], y, widths, { bold: true, bgColor: COLORS.lightGray });
            }

            const amount = parseFloat(txn.amount);
            y = drawTableRow(doc, [
                txn.date || '',
                txn.payee || '',
                txn.category_name || txn.category || '',
                txn.account_name || txn.account || '',
                txn.memo || '',
                amount >= 0 ? `$${amount.toFixed(2)}` : `-$${Math.abs(amount).toFixed(2)}`,
                txn.cleared ? '✓' : ''
            ], y, widths, {
                textColor: amount < 0 ? COLORS.red : COLORS.dark
            });
        }

        addPageNumber(doc);
        doc.end();
    });
}

/**
 * Generate a PDF of budget data for a month.
 */
export function generateBudgetPDF(budgetData, month, summary = {}) {
    if (!PDFDocument) throw new Error('pdfkit not installed. Run: npm install pdfkit');

    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const chunks = [];

    return new Promise((resolve, reject) => {
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        addHeader(doc, `Budget Report — ${month}`, `Generated: ${new Date().toLocaleDateString()}`);

        // Summary box
        if (summary.to_be_budgeted !== undefined) {
            doc.fontSize(11).fillColor(COLORS.dark);
            doc.text(`To Be Budgeted: $${parseFloat(summary.to_be_budgeted || 0).toFixed(2)}`);
            doc.text(`Month Income: $${parseFloat(summary.month_income || 0).toFixed(2)}    |    Month Expenses: $${Math.abs(parseFloat(summary.month_expenses || 0)).toFixed(2)}`);
            doc.moveDown();
        }

        const widths = [150, 80, 80, 80, 80];
        let y = drawTableRow(doc, ['Category', 'Assigned', 'Activity', 'Available', 'Goal %'], doc.y, widths, { bold: true, bgColor: COLORS.lightGray });

        for (const group of budgetData) {
            if (y > doc.page.height - 80) {
                doc.addPage();
                y = 50;
            }
            // Group header
            y = drawTableRow(doc, [group.name, '', '', '', ''], y, widths, { bold: true, bgColor: '#f1f5f9' });

            for (const cat of (group.categories || [])) {
                if (y > doc.page.height - 80) {
                    doc.addPage();
                    y = 50;
                }
                const avail = parseFloat(cat.available || 0);
                y = drawTableRow(doc, [
                    `  ${cat.name}`,
                    `$${parseFloat(cat.assigned || 0).toFixed(2)}`,
                    `$${parseFloat(cat.activity || 0).toFixed(2)}`,
                    `$${avail.toFixed(2)}`,
                    cat.goal_progress !== null ? `${parseFloat(cat.goal_progress || 0).toFixed(0)}%` : ''
                ], y, widths, {
                    textColor: avail < 0 ? COLORS.red : avail > 0 ? COLORS.green : COLORS.dark
                });
            }
        }

        addPageNumber(doc);
        doc.end();
    });
}

/**
 * Generate a PDF of net worth data over time.
 */
export function generateNetWorthPDF(history) {
    if (!PDFDocument) throw new Error('pdfkit not installed. Run: npm install pdfkit');

    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const chunks = [];

    return new Promise((resolve, reject) => {
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        addHeader(doc, 'Net Worth Report', `Generated: ${new Date().toLocaleDateString()}`);

        if (history.length > 0) {
            const latest = history[history.length - 1];
            const earliest = history[0];
            const change = latest.net_worth - earliest.net_worth;

            doc.fontSize(11).fillColor(COLORS.dark);
            doc.text(`Current Net Worth: $${latest.net_worth.toFixed(2)}`);
            doc.fillColor(change >= 0 ? COLORS.green : COLORS.red)
                .text(`Change over ${history.length} months: $${change.toFixed(2)} (${change >= 0 ? '+' : ''}${earliest.net_worth ? ((change / Math.abs(earliest.net_worth)) * 100).toFixed(1) : 0}%)`);
            doc.moveDown();
        }

        const widths = [120, 110, 110, 110];
        let y = drawTableRow(doc, ['Month', 'Assets', 'Liabilities', 'Net Worth'], doc.y, widths, { bold: true, bgColor: COLORS.lightGray });

        for (const row of history) {
            if (y > doc.page.height - 80) {
                doc.addPage();
                y = 50;
                y = drawTableRow(doc, ['Month', 'Assets', 'Liabilities', 'Net Worth'], y, widths, { bold: true, bgColor: COLORS.lightGray });
            }
            y = drawTableRow(doc, [
                row.month,
                `$${row.assets.toFixed(2)}`,
                `$${row.liabilities.toFixed(2)}`,
                `$${row.net_worth.toFixed(2)}`
            ], y, widths, {
                textColor: row.net_worth >= 0 ? COLORS.dark : COLORS.red
            });
        }

        addPageNumber(doc);
        doc.end();
    });
}
