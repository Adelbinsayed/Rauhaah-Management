import type { ImportType } from './types';
import { isTauriRuntime } from '@/data/db';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/app/store';

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
 * Initiates browser / desktop file download for a CSV string and triggers the download success popup
 */
export async function downloadCsvFile(filename: string, content: string): Promise<void> {
  const targetFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  let savedPath = '';

  if (isTauriRuntime()) {
    try {
      savedPath = await invoke<string>('export_csv_file', {
        filename: targetFilename,
        content,
      });
    } catch (e) {
      console.warn('Tauri export_csv_file failed:', e);
    }
  }

  if (!savedPath) {
    const uri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(content);
    const link = document.createElement('a');
    link.setAttribute('href', uri);
    link.setAttribute('download', targetFilename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
    }, 100);
    savedPath = targetFilename;
  }

  useAppStore.getState().showExportSuccess({
    filename: targetFilename,
    filePath: savedPath || targetFilename,
    title: 'Template Downloaded Successfully!',
    message: 'CSV template file has been saved to your computer.',
  });
}
