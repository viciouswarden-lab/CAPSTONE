# Firebase Cloud Functions - PRO SYNAPSE

This directory contains Firebase Cloud Functions for PRO SYNAPSE. These serverless functions handle background processing tasks triggered by various events.

## Functions

### 1. onPricelistUpload

**Trigger:** Cloud Storage object finalized
**Path:** `pricelists/{supplierId}/{filename}`
**Purpose:** Automatically process uploaded pricelists

**How it works:**
1. Triggered when a file is uploaded to the `pricelists` storage bucket
2. Determines file format (CSV, Excel, PDF) from filename
3. Downloads and parses the file content
4. Stores parsed data in Firestore:
   - Creates a document in `pricelists` collection
   - Creates documents for each item in `pricelist_items` collection
5. Handles errors gracefully and logs failures

**Supported formats:**
- CSV (fully supported)
- Excel (placeholder - requires xlsx library)
- PDF (placeholder - requires pdf parsing library)

**File path format:**
```
pricelists/{supplierId}/{filename}.csv
```

**Metadata:**
- `uploadedBy`: User ID who uploaded the file (optional, defaults to 'system')

**Requirements:** 3.5

## Setup

### Install dependencies

```bash
cd functions
npm install
```

### Build the functions

```bash
npm run build
```

### Deploy to Firebase

```bash
npm run deploy
```

### Local development

Run the Firebase emulator suite:

```bash
npm run serve
```

This will start the Functions emulator along with Firestore and Storage emulators.

## Project Structure

```
functions/
├── src/
│   ├── index.ts                    # Entry point, function exports
│   ├── triggers/
│   │   └── pricelistProcessor.ts   # Pricelist upload handler
│   └── utils/
│       └── parser.ts                # File parsing utilities
├── lib/                             # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
└── .gitignore
```

## Error Handling

The pricelist processor implements robust error handling:

1. **Invalid file path**: Logs error if path doesn't match expected format
2. **Unsupported format**: Logs error for non-CSV/Excel/PDF files
3. **Parse errors**: Catches and logs descriptive parsing errors
4. **Unexpected errors**: Logs error and re-throws to mark function as failed

All processing errors are stored in the `pricelist_processing_errors` collection for debugging.

## Extending

### Adding Excel support

1. Install xlsx library:
   ```bash
   cd functions
   npm install xlsx
   ```

2. Implement `parseExcelContent` in `src/utils/parser.ts`

3. Redeploy functions

### Adding PDF support

1. Install pdf parsing library:
   ```bash
   cd functions
   npm install pdf-parse
   ```

2. Implement `parsePDFContent` in `src/utils/parser.ts`

3. Redeploy functions

## Testing

To test the pricelist upload function:

1. Start the Firebase emulator:
   ```bash
   npm run serve
   ```

2. Upload a test CSV file to the emulated storage:
   ```bash
   gsutil cp test-pricelist.csv gs://your-project.appspot.com/pricelists/SUPPLIER001/test.csv
   ```

3. Check the emulator logs for processing output

4. Verify data in Firestore emulator UI

## Monitoring

View function logs in Firebase Console:
```
https://console.firebase.google.com/project/YOUR_PROJECT/functions/logs
```

Or via CLI:
```bash
npm run logs
```

## Configuration

Function configuration in `src/index.ts`:

- **Region:** us-central1
- **Memory:** 512 MiB
- **Timeout:** 300 seconds (5 minutes)
- **Bucket:** pricelists

Adjust these settings based on your file sizes and processing requirements.
