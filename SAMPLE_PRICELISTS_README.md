# 📋 Sample Supplier Pricelists for Testing

This folder contains sample CSV pricelists you can use to test the automatic pricelist processing feature.

## 📁 Available Sample Files

### 1. `sample_pricelist_abc_hardware.csv`
**Supplier**: ABC Hardware Supply Co.  
**Items**: 70 products  
**Categories**: Hand Tools, Power Tools, Electrical, Plumbing, Paint, Safety, Fasteners  

**Format**:
```csv
Supplier Code,Description,Price,UOM
HW-HAM-001,Heavy Duty Hammer 16oz with Rubber Grip,285.00,PCS
...
```

### 2. `sample_pricelist_quality_tools.csv`
**Supplier**: Quality Tools Inc.  
**Items**: 41 products  
**Categories**: Power Tools, Hand Tools, Measuring, Workbenches, Air Tools, Accessories  

**Format**:
```csv
Product Code,Product Description,Unit Price,Unit
QT-PWR-001,Professional Power Drill 20V Lithium Brushless,4250.00,PCS
...
```

## 🧪 How to Test

### Step 1: Create Suppliers First
Before uploading pricelists, make sure you have suppliers created:

1. Go to: http://localhost:4321/suppliers/new
2. Create these suppliers:
   - **Name**: ABC Hardware Supply Co.
   - **Name**: Quality Tools Inc.

### Step 2: Upload Pricelist

1. Go to: http://localhost:4321/pricelists/upload
2. Select a supplier from the dropdown
3. Click the upload area or drag and drop one of the sample CSV files
4. Click "Upload and Process"

### Step 3: View Results

After upload, you'll be redirected to the pricelists page where you can:
- View the uploaded pricelist in the list
- See item count and upload date
- Check if the data was saved to Firestore

### Step 4: Verify in Firestore

1. Go to: https://console.firebase.google.com/project/tpro-synapse/firestore
2. Check these collections:
   - **pricelists**: Should show the uploaded pricelist metadata
   - **pricelist_items**: Would contain individual product items (in full implementation)

## 📊 CSV Format Requirements

All sample files follow the standard format:

### Required Columns:
- **Supplier Code / Product Code**: Unique identifier
- **Description / Product Description**: Product name
- **Price / Unit Price**: Numeric price value
- **UOM / Unit**: Unit of measure (PCS, SET, BOX, etc.)

### Supported Column Name Variations:
The system accepts these column names interchangeably:
- Code: `Supplier Code`, `Product Code`, `Code`, `SKU`
- Description: `Description`, `Product Description`, `Product Name`, `Name`
- Price: `Price`, `Unit Price`, `Cost`, `Amount`
- UOM: `UOM`, `Unit`, `Unit of Measure`

## 🎯 What Gets Processed

When you upload a pricelist, the system will:

### Current Demo Implementation:
1. ✅ Validate file type and size
2. ✅ Save pricelist metadata to Firestore (`pricelists` collection)
3. ✅ Display in pricelists list page
4. ✅ Track upload date and supplier

### Full Production Implementation (requires Cloud Functions):
1. Upload file to Firebase Cloud Storage
2. Parse CSV/Excel/PDF automatically
3. Extract product data from all rows
4. Match products with existing catalog
5. Detect new products
6. Identify price changes
7. Store items in `pricelist_items` collection
8. Trigger notifications for price changes

## 💡 Testing Scenarios

### Scenario 1: Basic Upload
- Upload `sample_pricelist_abc_hardware.csv`
- Verify it appears in pricelists list
- Check Firestore for the record

### Scenario 2: Multiple Suppliers
- Upload ABC Hardware pricelist
- Upload Quality Tools pricelist
- Filter by supplier on pricelists page
- Verify stats show correct counts

### Scenario 3: Search Functionality
- Upload both pricelists
- Use search to find by supplier name
- Use search to find by filename

## 🔧 Modifying Sample Data

Feel free to modify the CSV files to test different scenarios:

### Add More Products:
```csv
NEW-CODE-001,New Product Description,999.00,PCS
```

### Change Prices (for testing price change detection):
```csv
HW-HAM-001,Heavy Duty Hammer 16oz with Rubber Grip,295.00,PCS
```
*(Original price was 285.00)*

### Different Units:
- PCS (Pieces)
- SET (Set)
- BOX (Box)
- ROLL (Roll)
- GAL (Gallon)
- PAIR (Pair)
- EACH (Each)
- PKG (Package)

## 📈 Expected Results

### After Upload:
- **Pricelists Page**: Shows new entry with:
  - Supplier name
  - File name
  - Upload date
  - Item count (0 in demo, actual count in production)
  - Status badge

- **Firestore Console**: `pricelists` collection contains:
  ```javascript
  {
    supplierId: "supplier-id",
    supplierName: "ABC Hardware Supply Co.",
    fileName: "sample_pricelist_abc_hardware.csv",
    uploadDate: Timestamp,
    uploadedBy: "user-id",
    itemCount: 0,
    status: "pending"
  }
  ```

### In Production (with Cloud Functions):
- Individual items in `pricelist_items` collection
- Product matching results
- New product detection
- Price change notifications
- Matching queue for review

## 🐛 Troubleshooting

### "Please select a supplier"
- Make sure you've created suppliers first at `/suppliers/new`
- Refresh the upload page to reload supplier list

### "Invalid file format"
- Only .csv, .xls, .xlsx, .pdf files are accepted
- Check the file extension is correct

### "File size exceeds 10MB"
- The sample files are small (~5-10KB)
- If you added many rows, keep total under 10MB

### File doesn't appear in list
- Refresh the pricelists page
- Check browser console (F12) for errors
- Verify Firestore rules allow write access
- Check Firebase Console to see if document was created

## 🚀 Next Steps

After testing with sample files:

1. **Create real supplier pricelists** in CSV format
2. **Test with actual data** from your suppliers
3. **Implement Cloud Functions** for automatic parsing
4. **Set up product matching** algorithms
5. **Configure price change alerts**
6. **Review and approve** matched products

## 📝 Notes

- **Demo Mode**: Current implementation saves metadata only
- **Production Mode**: Requires Firebase Cloud Functions and Blaze plan
- **File Parsing**: Full CSV/Excel/PDF parsing requires additional services
- **Security**: Firestore rules should validate user permissions

---

**Files Location**: `e:\CAPSTONE\adorable-axis\`  
**Upload Page**: http://localhost:4321/pricelists/upload  
**View Pricelists**: http://localhost:4321/pricelists  

Happy Testing! 🎉
