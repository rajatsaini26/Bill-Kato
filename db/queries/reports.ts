import { db } from '../client';

export interface MonthlyPnL {
  month: string;
  revenue: number;
  purchases: number;
  net_profit: number;
}

export interface QuarterlyPnL {
  year: string;
  quarter: string;
  revenue: number;
  purchases: number;
  net_profit: number;
}

export interface InvoicePnL {
  revenue: number;
  cogs: number;
  profit: number;
  marginPct: number;
}

export function getMonthlyPnL(startDate?: string | null, endDate?: string | null): MonthlyPnL[] {
  let salesWhere = "";
  let purchWhere = "";
  let salesParams: string[] = [];
  let purchParams: string[] = [];
  
  if (startDate && endDate) {
    salesWhere = "WHERE date(s.invoice_date) BETWEEN ? AND ?";
    purchWhere = "WHERE date(invoice_date) BETWEEN ? AND ?";
    salesParams.push(startDate, endDate);
    purchParams.push(startDate, endDate);
  } else if (startDate) {
    salesWhere = "WHERE date(s.invoice_date) >= ?";
    purchWhere = "WHERE date(invoice_date) >= ?";
    salesParams.push(startDate);
    purchParams.push(startDate);
  } else if (endDate) {
    salesWhere = "WHERE date(s.invoice_date) <= ?";
    purchWhere = "WHERE date(invoice_date) <= ?";
    salesParams.push(endDate);
    purchParams.push(endDate);
  }

  // Sales revenue and COGS
  const salesRows = db.getAllSync<{ month: string; total: number; cogs: number }>(
    `SELECT 
      strftime('%Y-%m', s.invoice_date) AS month, 
      SUM(CASE WHEN s.invoice_type = 'return' THEN -s.total ELSE s.total END) AS total,
      SUM(CASE WHEN s.invoice_type = 'return' THEN -(i.cost_price * i.quantity) ELSE (i.cost_price * i.quantity) END) AS cogs
     FROM sale_invoices s
     LEFT JOIN sale_invoice_items i ON s.id = i.invoice_id
     ${salesWhere}
     GROUP BY month ORDER BY month DESC`,
    salesParams
  );
  
  // Purchases (Assets)
  const purchaseRows = db.getAllSync<{ month: string; total: number }>(
    `SELECT strftime('%Y-%m', invoice_date) AS month, SUM(total) AS total
     FROM purchase_invoices ${purchWhere} GROUP BY month ORDER BY month DESC`,
    purchParams
  );

  const map: Record<string, MonthlyPnL> = {};
  for (const row of salesRows) {
    map[row.month] = { 
      month: row.month, 
      revenue: row.total, 
      purchases: 0, 
      net_profit: row.total - (row.cogs || 0) 
    };
  }
  for (const row of purchaseRows) {
    if (map[row.month]) {
      map[row.month].purchases = row.total;
    } else {
      map[row.month] = { month: row.month, revenue: 0, purchases: row.total, net_profit: 0 };
    }
  }
  return Object.values(map).sort((a, b) => b.month.localeCompare(a.month));
}

export function getQuarterlyPnL(startDate?: string | null, endDate?: string | null): QuarterlyPnL[] {
  let salesWhere = "";
  let purchWhere = "";
  let salesParams: string[] = [];
  let purchParams: string[] = [];
  
  if (startDate && endDate) {
    salesWhere = "WHERE date(s.invoice_date) BETWEEN ? AND ?";
    purchWhere = "WHERE date(invoice_date) BETWEEN ? AND ?";
    salesParams.push(startDate, endDate);
    purchParams.push(startDate, endDate);
  } else if (startDate) {
    salesWhere = "WHERE date(s.invoice_date) >= ?";
    purchWhere = "WHERE date(invoice_date) >= ?";
    salesParams.push(startDate);
    purchParams.push(startDate);
  } else if (endDate) {
    salesWhere = "WHERE date(s.invoice_date) <= ?";
    purchWhere = "WHERE date(invoice_date) <= ?";
    salesParams.push(endDate);
    purchParams.push(endDate);
  }

  const salesRows = db.getAllSync<{ year: string; quarter: string; total: number; cogs: number }>(
    `SELECT
      strftime('%Y', s.invoice_date) AS year,
      CASE
        WHEN CAST(strftime('%m', s.invoice_date) AS INT) BETWEEN 1 AND 3 THEN 'Q1'
        WHEN CAST(strftime('%m', s.invoice_date) AS INT) BETWEEN 4 AND 6 THEN 'Q2'
        WHEN CAST(strftime('%m', s.invoice_date) AS INT) BETWEEN 7 AND 9 THEN 'Q3'
        ELSE 'Q4'
      END AS quarter,
      SUM(CASE WHEN s.invoice_type = 'return' THEN -s.total ELSE s.total END) AS total,
      SUM(CASE WHEN s.invoice_type = 'return' THEN -(i.cost_price * i.quantity) ELSE (i.cost_price * i.quantity) END) AS cogs
     FROM sale_invoices s
     LEFT JOIN sale_invoice_items i ON s.id = i.invoice_id
     ${salesWhere}
     GROUP BY year, quarter ORDER BY year DESC, quarter DESC`,
    salesParams
  );
  const purchaseRows = db.getAllSync<{ year: string; quarter: string; total: number }>(
    `SELECT
      strftime('%Y', invoice_date) AS year,
      CASE
        WHEN CAST(strftime('%m', invoice_date) AS INT) BETWEEN 1 AND 3 THEN 'Q1'
        WHEN CAST(strftime('%m', invoice_date) AS INT) BETWEEN 4 AND 6 THEN 'Q2'
        WHEN CAST(strftime('%m', invoice_date) AS INT) BETWEEN 7 AND 9 THEN 'Q3'
        ELSE 'Q4'
      END AS quarter,
      SUM(total) AS total
     FROM purchase_invoices ${purchWhere} GROUP BY year, quarter ORDER BY year DESC, quarter DESC`,
    purchParams
  );

  const map: Record<string, QuarterlyPnL> = {};
  for (const row of salesRows) {
    const key = `${row.year}-${row.quarter}`;
    map[key] = { 
      year: row.year, 
      quarter: row.quarter, 
      revenue: row.total, 
      purchases: 0, 
      net_profit: row.total - (row.cogs || 0) 
    };
  }
  for (const row of purchaseRows) {
    const key = `${row.year}-${row.quarter}`;
    if (map[key]) {
      map[key].purchases = row.total;
    } else {
      map[key] = { year: row.year, quarter: row.quarter, revenue: 0, purchases: row.total, net_profit: 0 };
    }
  }
  return Object.values(map).sort((a, b) => {
    if (b.year !== a.year) return b.year.localeCompare(a.year);
    return b.quarter.localeCompare(a.quarter);
  });
}

export function getInvoicePnL(saleInvoiceId: number): InvoicePnL {
  const invoice = db.getFirstSync<{ total: number }>(
    `SELECT total FROM sale_invoices WHERE id = ?`,
    [saleInvoiceId]
  );
  const items = db.getAllSync<{ cost_price: number; quantity: number }>(
    `SELECT cost_price, quantity FROM sale_invoice_items WHERE invoice_id = ?`,
    [saleInvoiceId]
  );
  const revenue = invoice?.total ?? 0;
  const cogs = items.reduce((sum, i) => sum + i.cost_price * i.quantity, 0);
  const profit = revenue - cogs;
  const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
  return { revenue, cogs, profit, marginPct };
}

export function getDashboardStats(): {
  todaySales: number;
  todayPurchases: number;
  monthSales: number;
  monthPurchases: number;
  monthProfit: number;
} {
  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(0, 7);

  const todaySales = db.getFirstSync<{ val: number }>(
    `SELECT COALESCE(SUM(CASE WHEN invoice_type = 'return' THEN -total ELSE total END), 0) AS val FROM sale_invoices WHERE date(invoice_date) = ?`,
    [today]
  )?.val ?? 0;

  const todayPurchases = db.getFirstSync<{ val: number }>(
    `SELECT COALESCE(SUM(total), 0) AS val FROM purchase_invoices WHERE date(invoice_date) = ?`,
    [today]
  )?.val ?? 0;

  const monthSales = db.getFirstSync<{ val: number; cogs: number }>(
    `SELECT 
      COALESCE(SUM(CASE WHEN s.invoice_type = 'return' THEN -s.total ELSE s.total END), 0) AS val,
      COALESCE(SUM(CASE WHEN s.invoice_type = 'return' THEN -(i.cost_price * i.quantity) ELSE (i.cost_price * i.quantity) END), 0) AS cogs
     FROM sale_invoices s
     LEFT JOIN sale_invoice_items i ON s.id = i.invoice_id
     WHERE strftime('%Y-%m', s.invoice_date) = ?`,
    [month]
  );

  const monthPurchases = db.getFirstSync<{ val: number }>(
    `SELECT COALESCE(SUM(total), 0) AS val FROM purchase_invoices WHERE strftime('%Y-%m', invoice_date) = ?`,
    [month]
  )?.val ?? 0;

  return {
    todaySales,
    todayPurchases,
    monthSales: monthSales?.val ?? 0,
    monthPurchases,
    monthProfit: (monthSales?.val ?? 0) - (monthSales?.cogs ?? 0),
  };
}
