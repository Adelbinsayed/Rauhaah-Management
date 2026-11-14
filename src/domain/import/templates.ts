import type { ImportType } from './types';

export interface CsvTemplateDef {
  type: ImportType;
  fileName: string;
  title: string;
  description: string;
  content: string;
}

export const CSV_TEMPLATES: Record<ImportType, CsvTemplateDef> = {
  products: {
    type: 'products',
    fileName: 'products_template.csv',
    title: 'Products Master Template',
    description: 'Import new attars, packaged goods, accessories, initial stock, and prices in bulk.',
    content: `sku,barcode,name,category,brand,type,unit,cost_price,selling_price,wholesale_price,opening_stock
RAU-BLCK-OUD,,Black Oud Master Oil,Attar & Concentrated Oils,Rauhaah,oil,ml,150.00,215.00,195.00,500
RAU-JANAMAZ-TURK,,Turkish Embossed Janamaz,Prayer Mats,Rauhaah,packaged,pcs,650.00,950.00,850.00,25
RAU-MISWAK-OLIVE,,Natural Olive Root Miswak,Miswak,Al-Khair,packaged,pcs,35.00,60.00,50.00,100
RAU-COMB-NEEM,,Handmade Neem Wood Comb,Wooden Combs,Rauhaah,packaged,pcs,90.00,150.00,130.00,50
RAU-CAP-AFGHANI,,Classic Afghani Pakol Cap,Caps & Keffiyehs,Rauhaah,packaged,pcs,220.00,350.00,300.00,30
`,
  },
  prices: {
    type: 'prices',
    fileName: 'prices_template.csv',
    title: 'Price List Update Template',
    description: 'Bulk update retail selling prices, wholesale prices, or landing costs for existing SKUs.',
    content: `sku,barcode,selling_price,wholesale_price,cost_price
PRD-741484,,175.00,155.00,115.00
RAU-BLCK-OUD,,225.00,200.00,160.00
RAU-JANAMAZ-TURK,,980.00,880.00,
`,
  },
  stock: {
    type: 'stock',
    fileName: 'stock_template.csv',
    title: 'Stock Count / Opening Inventory Template',
    description: 'Set or update physical inventory quantities and unit cost prices in bulk.',
    content: `sku,barcode,quantity,cost_price,notes
PRD-741484,,60,115.00,Monthly stock count verification
RAU-BLCK-OUD,,450,150.00,Warehouse intake
RAU-JANAMAZ-TURK,,30,,Physical audit
`,
  },
};

/**
 * Initiates browser file download for a CSV string
 */
export function downloadCsvFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
