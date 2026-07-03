# Implementation Plan: PRO SYNAPSE

## Overview

This implementation plan breaks down the PRO SYNAPSE system into discrete coding tasks. The system is built using Astro 7.x with TypeScript for the frontend and Firebase (Firestore, Authentication, Cloud Functions, Storage) for the backend. Each task focuses on implementing specific components that build incrementally toward the complete system.

The implementation follows a layered approach: data models and Firebase configuration first, then service layer components, followed by UI pages and components, and finally integration and testing.

## Tasks

- [x] 1. Initialize project structure and Firebase configuration
  - Set up Firebase project and obtain configuration credentials
  - Install Firebase SDK dependencies (firebase, @firebase/app, @firebase/auth, @firebase/firestore, @firebase/storage, @firebase/functions)
  - Create Firebase configuration module at `src/services/firebase/config.ts`
  - Initialize Firebase app, authentication, Firestore, storage, and functions clients
  - Configure Firestore security rules in `firestore.rules`
  - Configure Firebase storage rules in `storage.rules`
  - Create Firestore composite indexes configuration in `firestore.indexes.json`
  - Set up TypeScript path aliases in `tsconfig.json` for clean imports
  - _Requirements: 1.1, 1.3, 19.1, 19.2_

- [x] 2. Implement core data models and type definitions
  - [x] 2.1 Create Firestore document type definitions
    - Define all Firestore collection document interfaces in `src/types/firestore.ts`
    - Include: UserDoc, SupplierDoc, ProductDoc, PricelistDoc, PricelistItemDoc, PriceChangeDoc
    - Include: InventoryDoc, InventoryTransactionDoc, ReceivingRecordDoc, InvoiceDoc, POSTransactionDoc
    - Include: PricingDoc, ReportConfigDoc
    - _Requirements: 7.1, 7.4, 2.1, 8.1_

  
  - [x] 2.2 Create service layer interfaces
    - Define service interfaces in `src/types/services.ts`
    - Include: AuthService, ParserService, PrettyPrinterService, MatcherService
    - Include: PriceMonitorService, InventoryService, POSService, ReportingService
    - Define all related data transfer objects and enums
    - _Requirements: 1.1, 3.1, 4.1, 6.1, 8.2, 13.1_

  - [x] 2.3 Create domain model types
    - Define domain models in `src/types/models.ts`
    - Include: User, UserRole, Permission, Supplier, Product, PricelistData, InvoiceData, DeliveryReceiptData
    - Include: MatchingResult, PriceChange, InventoryAdjustment, POSTransaction, Report types
    - _Requirements: 2.1, 3.2, 4.2, 6.2, 8.2, 10.1, 11.1, 13.2_

- [x] 3. Implement authentication service
  - [x] 3.1 Create authentication service implementation
    - Implement AuthService interface in `src/services/auth/AuthService.ts`
    - Implement login, logout, getCurrentUser, checkPermission methods
    - Implement session validation and token refresh logic
    - Implement role-based permission checking with Permission enum
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6_

  - [x] 3.2 Implement account lockout mechanism
    - Add failed login attempt tracking in Firestore
    - Implement lockAccount method with configurable duration
    - Check lockout status before allowing authentication
    - _Requirements: 19.6_

  
  - [x] 3.3 Write unit tests for authentication service
    - Test successful login with valid credentials
    - Test failed login with invalid credentials
    - Test session expiration handling
    - Test account lockout after multiple failed attempts
    - Test role-based permission checks
    - _Requirements: 1.1, 1.2, 1.7, 19.6_

- [ ] 4. Implement document parsing services
  - [x] 4.1 Create CSV parser for pricelists
    - Implement CSV parsing in `src/services/parsers/CSVParser.ts`
    - Extract supplier code, description, price, and optional UOM fields
    - Handle missing columns and malformed rows with descriptive errors
    - Return PricelistData structure
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 4.2 Create Excel parser for pricelists
    - Install SheetJS dependency (xlsx)
    - Implement Excel parsing in `src/services/parsers/ExcelParser.ts`
    - Support .xls and .xlsx formats
    - Extract same fields as CSV parser
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 4.3 Create PDF parser for pricelists
    - Install PDF.js dependency (pdfjs-dist)
    - Implement PDF parsing in `src/services/parsers/PDFParser.ts`
    - Extract text content and parse tabular data
    - Handle multi-page documents
    - _Requirements: 3.1, 3.2, 3.3_

  
  - [x] 4.4 Create invoice parser
    - Implement invoice parsing in `src/services/parsers/InvoiceParser.ts`
    - Extract supplier name, invoice number, date, line items with quantities and prices
    - Calculate and validate total amount
    - Support CSV, Excel, and PDF formats using appropriate sub-parsers
    - _Requirements: 10.1, 10.2_

  - [x] 4.5 Create delivery receipt parser
    - Implement delivery receipt parsing in `src/services/parsers/DeliveryReceiptParser.ts`
    - Extract supplier name, delivery date, line items with quantities
    - Support CSV, Excel, and PDF formats
    - _Requirements: 11.1, 11.2_

  - [x] 4.6 Write property test for pricelist round-trip preservation
    - **Property 1: Pricelist Round-Trip Preservation**
    - **Validates: Requirements 3.7**
    - Generate random valid PricelistData structures
    - Test: parse → print → parse produces equivalent structure
    - Verify product codes, descriptions, and prices remain identical
    - _Requirements: 3.7_

  - [x] 4.7 Write property test for invoice round-trip preservation
    - **Property 2: Invoice Round-Trip Preservation**
    - **Validates: Requirements 10.7**
    - Generate random valid InvoiceData structures
    - Test: print → parse → print produces equivalent structure
    - Verify all invoice fields including line items remain identical
    - _Requirements: 10.7_

  
  - [x] 4.8 Write property test for delivery receipt round-trip preservation
    - **Property 3: Delivery Receipt Round-Trip Preservation**
    - **Validates: Requirements 11.7**
    - Generate random valid DeliveryReceiptData structures
    - Test: print → parse → print produces equivalent structure
    - Verify supplier name, date, and line items remain identical
    - _Requirements: 11.7_

  - [x] 4.9 Write property test for parser error handling
    - **Property 4: Parser Error Handling**
    - **Validates: Requirements 3.3, 10.2, 11.2**
    - Generate malformed documents (missing columns, corrupted data, invalid formats)
    - Test that parsers return descriptive errors without crashing
    - Verify no partial or incorrect data is returned
    - _Requirements: 3.3, 10.2, 11.2_

- [x] 5. Implement pretty printer services
  - [x] 5.1 Create CSV pretty printer for pricelists
    - Implement CSV formatting in `src/services/printers/CSVPrinter.ts`
    - Convert PricelistData to valid CSV format string
    - Include header row with column names
    - _Requirements: 3.6_

  - [x] 5.2 Create invoice pretty printer
    - Implement invoice formatting in `src/services/printers/InvoicePrinter.ts`
    - Convert InvoiceData to formatted document string
    - _Requirements: 10.6_

  
  - [x] 5.3 Create delivery receipt pretty printer
    - Implement delivery receipt formatting in `src/services/printers/DeliveryReceiptPrinter.ts`
    - Convert DeliveryReceiptData to formatted document string
    - _Requirements: 11.6_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement product matching service
  - [x] 7.1 Create exact matcher
    - Implement exact SKU matching in `src/services/matching/ExactMatcher.ts`
    - Compare supplier codes against internal SKU database
    - Return matches with confidence 1.0
    - _Requirements: 4.1, 4.2_
 
  - [x] 7.2 Create fuzzy matcher
    - Implement fuzzy text matching in `src/services/matching/FuzzyMatcher.ts`
    - Use Levenshtein distance and cosine similarity algorithms
    - Calculate confidence scores between 0 and 1
    - Return top match suggestions
    - _Requirements: 4.3, 4.4_

  - [x] 7.3 Create AI matcher integration
    - Implement AI service wrapper in `src/services/matching/AIMatcher.ts`
    - Integrate with Firebase ML Kit or external AI service
    - Perform semantic product description matching
    - _Requirements: 4.3_

  
  - [x] 7.4 Create product matcher service orchestrator
    - Implement MatcherService in `src/services/matching/MatcherService.ts`
    - Orchestrate exact matching first, then fuzzy/AI matching for unmatched items
    - Implement matchProducts, suggestMatch, confirmMatch, findUnmatchedProducts methods
    - Apply 0.85 confidence threshold for suggestions
    - Store match confirmations to improve learning
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8_

  - [x] 7.5 Write property test for product matching correctness
    - **Property 5: Product Matching Correctness**
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - Generate supplier products with exact SKU matches
    - Test that exact matches create Matched_Product with confidence 1.0
    - Generate products without exact matches
    - Test that fuzzy matching is invoked
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 7.6 Write property test for match confidence threshold classification
    - **Property 6: Match Confidence Threshold Classification**
    - **Validates: Requirements 4.4, 4.5**
    - Generate fuzzy match results with various confidence scores
    - Test that confidence > 0.85 creates suggestions
    - Test that confidence < 0.85 marks as Unmatched_Product
    - _Requirements: 4.4, 4.5_


- [x] 8. Implement new product detection
  - [x] 8.1 Create new product detector
    - Implement new product detection in `src/services/matching/NewProductDetector.ts`
    - Compare current pricelist against previous pricelist from same supplier
    - Identify products present in new but absent from previous
    - Flag detected products as new
    - _Requirements: 5.1, 5.2_

  - [x] 8.2 Write property test for new product detection
    - **Property 7: New Product Detection**
    - **Validates: Requirements 5.1, 5.2**
    - Generate pairs of pricelists from the same supplier
    - Add products to new pricelist not in previous
    - Test that all added products are correctly identified as new
    - Test that existing products are not flagged as new
    - _Requirements: 5.1, 5.2_

- [x] 9. Implement price monitoring service
  - [x] 9.1 Create price change detector
    - Implement price comparison in `src/services/pricing/PriceChangeDetector.ts`
    - Compare current prices against previous pricelist prices
    - Calculate absolute difference and percentage change
    - Use formula: percentage_change = ((new_price - old_price) / old_price) * 100
    - _Requirements: 6.1, 6.2_

  
  - [x] 9.2 Create price monitor service
    - Implement PriceMonitorService in `src/services/pricing/PriceMonitorService.ts`
    - Implement detectPriceChanges, getPriceHistory, getSignificantChanges methods
    - Flag price changes > 10% as significant
    - Store price change records in Firestore
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 9.3 Write property test for price change detection and calculation
    - **Property 8: Price Change Detection and Calculation**
    - **Validates: Requirements 6.1, 6.2**
    - Generate matched products with different old and new prices
    - Test that percentage change calculation is correct
    - Verify formula: ((new - old) / old) * 100
    - _Requirements: 6.1, 6.2_

  - [x] 9.4 Write property test for significant price change flagging
    - **Property 9: Significant Price Change Flagging**
    - **Validates: Requirements 6.3**
    - Generate price changes with various percentage changes
    - Test that increases > 10% are flagged as significant
    - Test that increases ≤ 10% are not flagged
    - Test that price decreases are not flagged
    - _Requirements: 6.3_

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [x] 11. Implement inventory management service
  - [x] 11.1 Create inventory service core operations
    - Implement InventoryService in `src/services/inventory/InventoryService.ts`
    - Implement getQuantityOnHand with optional location filtering
    - Implement adjustInventory with atomic Firestore transactions
    - Use formula: new_quantity = current_quantity + quantity_change
    - Implement getInventoryHistory with date range filtering
    - _Requirements: 8.1, 8.2, 8.3, 8.6, 8.7_

  - [x] 11.2 Create low stock alert system
    - Implement low stock detection in inventory service
    - Implement getLowStockItems method
    - Compare current quantity against reorder point
    - Generate alerts when quantity < reorder_point
    - _Requirements: 8.4_

  - [x] 11.3 Implement receiving and sales transaction handlers
    - Implement processReceiving method
    - Implement processSale method
    - Update inventory quantities using atomic transactions
    - Create inventory transaction records for audit trail
    - _Requirements: 8.2, 8.3_

  - [x] 11.4 Write property test for inventory quantity adjustment
    - **Property 10: Inventory Quantity Adjustment**
    - **Validates: Requirements 8.2, 8.3**
    - Generate inventory records with various quantities
    - Generate transactions with positive and negative changes
    - Test that new_quantity = old_quantity + quantity_change
    - Test atomic transaction behavior
    - _Requirements: 8.2, 8.3_

  
  - [x] 11.5 Write property test for low stock alert generation
    - **Property 11: Low Stock Alert Generation**
    - **Validates: Requirements 8.4**
    - Generate products with various quantities and reorder points
    - Test that alerts are generated when quantity < reorder_point
    - Test that no alerts are generated when quantity ≥ reorder_point
    - _Requirements: 8.4_

- [x] 12. Implement receiving management service
  - [x] 12.1 Create receiving service
    - Implement receiving operations in `src/services/receiving/ReceivingService.ts`
    - Create receiving record creation and management
    - Implement variance detection comparing expected vs received quantities
    - Flag variances > 5% for review
    - Update inventory upon receiving completion
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 12.2 Write property test for receiving variance detection
    - **Property 12: Receiving Variance Detection**
    - **Validates: Requirements 9.5**
    - Generate receiving records with expected and received quantities
    - Test that variance > 5% flags the record for review
    - Test that variance ≤ 5% does not flag
    - _Requirements: 9.5_

  - [x] 12.3 Write property test for invoice variance detection
    - **Property 13: Invoice Variance Detection**
    - **Validates: Requirements 10.4**
    - Generate invoice line items and receiving records
    - Test that quantity or price variance > 5% flags for review
    - _Requirements: 10.4_


- [x] 13. Implement pricing management service
  - [x] 13.1 Create pricing service
    - Implement pricing operations in `src/services/pricing/PricingService.ts`
    - Implement retail price management with effective dates
    - Calculate suggested retail price: retail_price = cost * (1 + margin/100)
    - Round to 2 decimal places
    - Support multiple pricing tiers
    - Detect and warn on negative margins (price < cost)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 13.2 Write property test for retail price calculation with margin
    - **Property 14: Retail Price Calculation with Margin**
    - **Validates: Requirements 12.2**
    - Generate supplier costs and margin percentages
    - Test formula: retail_price = cost * (1 + margin/100)
    - Verify rounding to 2 decimal places
    - _Requirements: 12.2_

  - [x] 13.3 Write property test for negative margin detection
    - **Property 15: Negative Margin Detection**
    - **Validates: Requirements 12.6**
    - Generate retail prices and supplier costs
    - Test that warning is displayed when price < cost
    - Test that no warning when price ≥ cost
    - _Requirements: 12.6_

- [x] 14. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [x] 15. Implement POS service
  - [x] 15.1 Create POS service core operations
    - Implement POSService in `src/services/pos/POSService.ts`
    - Implement lookupProduct with fast SKU-based retrieval
    - Implement createTransaction with line item calculations
    - Calculate line totals: line_total = quantity * unit_price (rounded to 2 decimals)
    - Calculate transaction subtotal, tax, and total
    - Update inventory atomically on transaction completion
    - _Requirements: 13.1, 13.2, 13.3, 13.6_

  - [x] 15.2 Implement transaction void functionality
    - Implement voidTransaction method
    - Reverse inventory adjustments (restore original quantities)
    - Mark transaction as voided with timestamp and user
    - Maintain audit trail
    - _Requirements: 13.5_

  - [x] 15.3 Implement offline transaction queue
    - Create offline transaction queue in `src/services/pos/OfflineQueue.ts`
    - Store transactions locally when network unavailable
    - Implement background sync with retry logic
    - Handle conflict resolution with last-write-wins strategy
    - _Requirements: 13.7_

  - [x] 15.4 Write property test for POS line total calculation
    - **Property 16: POS Line Total Calculation**
    - **Validates: Requirements 13.2**
    - Generate line items with various quantities and prices
    - Test formula: line_total = quantity * unit_price
    - Verify rounding to 2 decimal places
    - _Requirements: 13.2_

  
  - [x] 15.5 Write property test for transaction void inventory reversal
    - **Property 17: Transaction Void Inventory Reversal**
    - **Validates: Requirements 13.5**
    - Generate completed POS transactions with inventory decreases
    - Void the transactions
    - Test that inventory quantities are restored exactly
    - _Requirements: 13.5_

- [x] 16. Implement reporting service
  - [x] 16.1 Create reporting service
    - Implement ReportingService in `src/services/reporting/ReportingService.ts`
    - Implement generateSalesReport with revenue, units sold, margin calculations
    - Implement generateInventoryReport with stock levels, value, turnover rates
    - Implement generateSupplierReport with price stability, delivery reliability metrics
    - Support grouping and filtering options
    - _Requirements: 15.1, 15.2, 15.3, 15.5_

  - [x] 16.2 Implement report export functionality
    - Install PDF generation library (e.g., jsPDF) and Excel library (xlsx)
    - Implement exportReport method supporting PDF and Excel formats
    - Format reports appropriately for each output format
    - _Requirements: 15.4_

  - [x] 16.3 Implement report configuration management
    - Implement saveReportConfig and loadReportConfig methods
    - Store user-specific report configurations in Firestore
    - Support reusable report templates
    - _Requirements: 15.6_


- [x] 17. Implement supplier management service
  - [x] 17.1 Create supplier service
    - Implement supplier CRUD operations in `src/services/suppliers/SupplierService.ts`
    - Create, read, update, deactivate supplier records
    - Implement search functionality with text matching
    - Maintain audit trail for all operations
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 18. Implement product management service
  - [x] 18.1 Create product service
    - Implement product CRUD operations in `src/services/products/ProductService.ts`
    - Enforce unique SKU constraints
    - Support product search with category, supplier, status filters
    - Maintain version history for product changes
    - Store supplier mappings with last cost information
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 19. Implement user management service
  - [x] 19.1 Create user management service
    - Implement user CRUD operations in `src/services/users/UserManagementService.ts`
    - Create user accounts with role assignment
    - Implement role-based permission application
    - Support user activation/deactivation
    - Maintain audit log of user actions
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

- [x] 20. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [x] 21. Create Astro layouts and components
  - [x] 21.1 Create main layout component
    - Create MainLayout.astro in `src/layouts/`
    - Implement authentication checking with requireAuth prop
    - Implement role-based access control with requiredRole prop
    - Include navigation menu with role-based visibility
    - Add global styles and meta tags
    - _Requirements: 1.3, 1.4, 20.1_

  - [x] 21.2 Create reusable UI components
    - Create ErrorMessage.astro for validation errors
    - Create LoadingSpinner.astro for loading states
    - Create DataTable.astro for tabular data display
    - Create SearchBar.astro for search functionality
    - Create Modal.astro for dialogs and confirmations
    - _Requirements: 20.2, 20.3, 20.6_

- [x] 22. Create authentication pages
  - [x] 22.1 Create login page
    - Create `/src/pages/login.astro`
    - Implement login form with email and password fields
    - Call AuthService.login on form submission
    - Display error messages for invalid credentials
    - Redirect to dashboard on successful login
    - _Requirements: 1.1, 1.2, 20.3_

  - [x] 22.2 Create session management
    - Implement session state management using cookies or localStorage
    - Add session validation middleware
    - Handle token refresh logic
    - Implement automatic redirect to login on session expiration
    - _Requirements: 1.5, 1.6, 1.7_


- [x] 23. Create dashboard page
  - [x] 23.1 Implement dashboard page
    - Create `/src/pages/index.astro` as dashboard
    - Display total sales revenue (day, week, month)
    - Display current inventory value
    - Display low stock item count
    - Display recent significant price increases
    - Display unmatched product count
    - Display new product count
    - Implement auto-refresh every 5 minutes
    - Optimize query performance to render within 3 seconds
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8_

- [ ] 24. Create supplier management pages
  - [x] 24.1 Create supplier list page
    - Create `/src/pages/suppliers/index.astro`
    - Display searchable list of all suppliers
    - Show supplier name, contact, status
    - Implement search with 2-second max response time
    - Add navigation to detail/edit pages
    - _Requirements: 2.4, 2.5_

  - [x] 24.2 Create supplier detail/edit page
    - Create `/src/pages/suppliers/[id].astro`
    - Display supplier details
    - Implement edit form with validation
    - Support deactivation with confirmation dialog
    - _Requirements: 2.1, 2.2, 2.3_


- [ ] 25. Create pricelist management pages
  - [x] 25.1 Create pricelist upload page
    - Create `/src/pages/pricelists/upload.astro`
    - Implement file upload interface accepting CSV, Excel, PDF
    - Upload file to Firebase Cloud Storage
    - Trigger parser service with progress indicator
    - Display parsing results or errors
    - Ensure processing completes within 60 seconds for 10,000 items
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 20.6_

  - [x] 25.2 Create pricelist review page
    - Create `/src/pages/pricelists/[id].astro`
    - Display parsed pricelist items in table
    - Show match status for each item
    - Highlight new products and significant price changes
    - Support filtering and search
    - _Requirements: 5.3, 5.4, 6.6_

- [x] 26. Create product management pages
  - [x] 26.1 Create product catalog page
    - Create `/src/pages/products/index.astro`
    - Display searchable product catalog
    - Support filtering by category, supplier, status
    - Return search results within 2 seconds
    - Navigate to product detail pages
    - _Requirements: 7.5, 7.6_

  - [x] 26.2 Create product detail/edit page
    - Create `/src/pages/products/[sku].astro`
    - Display product information including supplier mappings
    - Implement edit form with validation
    - Enforce unique SKU constraint
    - Support product deactivation
    - _Requirements: 7.1, 7.2, 7.3, 7.4_


- [x] 27. Create product matching pages
  - [x] 27.1 Create product matching queue page
    - Create `/src/pages/matching/index.astro`
    - Display unmatched products requiring review
    - Display suggested matches with confidence scores
    - _Requirements: 4.7_

  - [x] 27.2 Create product match review interactive component
    - Create ProductMatchReview component (React/Vue/Svelte)
    - Display supplier product details and suggested matches
    - Allow user to confirm or reject suggestions
    - Call MatcherService.confirmMatch on confirmation
    - Update match learning system
    - _Requirements: 4.6_

- [ ] 28. Create inventory management pages
  - [x] 28.1 Create inventory status page
    - Create `/src/pages/inventory/index.astro`
    - Display current inventory quantities by location
    - Show low stock alerts prominently
    - Support filtering and search
    - Return results within 2 seconds
    - _Requirements: 8.5_

  - [x] 28.2 Create inventory adjustment page
    - Create `/src/pages/inventory/adjust.astro`
    - Implement adjustment form with reason and notes
    - Call InventoryService.adjustInventory
    - Display confirmation and updated quantities
    - _Requirements: 8.7_

  - [x] 28.3 Create inventory history page
    - Create `/src/pages/inventory/history/[sku].astro`
    - Display transaction history for a product
    - Support date range filtering
    - Show quantity changes, transaction types, and users
    - _Requirements: 8.6_


- [x] 29. Create receiving pages
  - [x] 29.1 Create receiving list page
    - Create `/src/pages/receiving/index.astro`
    - Display pending and completed receiving records
    - Support filtering by date and supplier
    - Highlight variance flags
    - _Requirements: 9.6_

  - [x] 29.2 Create receiving form page
    - Create `/src/pages/receiving/new.astro`
    - Implement receiving record creation form
    - Support manual entry and document upload
    - Validate product existence
    - Display expected vs received quantity comparison
    - _Requirements: 9.1, 9.2, 9.4, 9.5_

  - [x] 29.3 Create receiving completion handler
    - Implement receiving completion workflow
    - Call InventoryService.processReceiving
    - Update all inventory records atomically
    - _Requirements: 9.3_

- [x] 30. Create invoice processing pages
  - [x] 30.1 Create invoice upload page
    - Create `/src/pages/invoices/upload.astro`
    - Implement invoice document upload
    - Parse invoice using InvoiceParser
    - Display extracted data for review
    - Match against receiving records
    - Highlight variances > 5%
    - Process within 30 seconds for 100 line items
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_


- [x] 31. Create pricing management pages
  - [x] 31.1 Create pricing page
    - Create `/src/pages/pricing/index.astro`
    - Display products with current pricing across tiers
    - Show supplier costs and calculated margins
    - Support bulk price updates
    - Display price history
    - _Requirements: 12.1, 12.3, 12.4, 12.5_

  - [x] 31.2 Implement price calculation and warning logic
    - Calculate suggested retail price: cost * (1 + margin/100)
    - Display warning when price < cost (negative margin)
    - Allow override with confirmation
    - _Requirements: 12.2, 12.6_

- [x] 32. Create POS pages and components
  - [x] 32.1 Create POS interface page
    - Create `/src/pages/pos/index.astro`
    - Implement product lookup with SKU scanning
    - Display product details within 1 second
    - Build transaction cart with line items
    - Calculate and display subtotal, tax, total
    - Support multiple payment methods
    - Complete transaction within 5 seconds
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.6_

  - [x] 32.2 Create transaction void page
    - Create `/src/pages/pos/void.astro`
    - Display recent transactions
    - Implement void functionality with confirmation
    - Call POSService.voidTransaction
    - _Requirements: 13.5_

  
  - [x] 32.3 Implement POS offline support
    - Integrate OfflineQueue into POS interface
    - Display offline status indicator
    - Queue transactions when network unavailable
    - Show sync status and pending transaction count
    - _Requirements: 13.7_

- [x] 33. Create reporting pages
  - [x] 33.1 Create reports page
    - Create `/src/pages/reports/index.astro`
    - Display report type selection (sales, inventory, supplier)
    - Implement filter and configuration UI
    - Generate report with 5-second max for filtered results
    - Display report data in formatted tables/charts
    - _Requirements: 15.1, 15.2, 15.3, 15.5_

  - [x] 33.2 Implement report export functionality
    - Add export buttons for PDF and Excel
    - Call ReportingService.exportReport
    - Trigger download with generated file
    - _Requirements: 15.4_

  - [x] 33.3 Implement report configuration saving
    - Add "Save Configuration" functionality
    - Store report configs in Firestore
    - Display saved configurations for reuse
    - _Requirements: 15.6, 15.7_

- [x] 34. Create user management pages (admin)
  - [x] 34.1 Create user management page
    - Create `/src/pages/admin/users/index.astro`
    - Require Administrator role
    - Display list of user accounts with roles and status
    - _Requirements: 16.4_

  
  - [x] 34.2 Create user create/edit page
    - Create `/src/pages/admin/users/[id].astro`
    - Implement user creation form with required fields
    - Implement role assignment
    - Support user activation/deactivation
    - Apply permission changes immediately
    - _Requirements: 16.1, 16.2, 16.3, 16.5_

  - [x] 34.3 Create audit log page
    - Create `/src/pages/admin/audit.astro`
    - Display user action audit log
    - Support filtering by user, action type, date
    - _Requirements: 16.6_

- [x] 35. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 36. Implement client-side alternatives to Cloud Functions (Blaze plan not available)
  - [x] 36.1 Integrate pricelist processing into upload workflow
    - Pricelist parsing occurs on upload page
    - No Cloud Function trigger needed
    - Already implemented in task 25.1
    - _Requirements: 3.5_

  - [x] 36.2 Add price change notifications to PriceMonitorService
    - Call notification logic when detectPriceChanges completes
    - Update dashboard metrics in the same operation
    - Send notifications for significant price changes
    - _Requirements: 6.6_

  - [x] 36.3 Add low stock alert checks to InventoryService
    - Check reorder points after adjustInventory operations
    - Generate alerts when quantity < reorder_point
    - Create/update alert documents in Firestore
    - _Requirements: 8.4_

  - [x] 36.4 Document Cloud Functions for future migration
    - Preserve Cloud Functions code in /functions folder
    - Document migration path when Blaze plan becomes available
    - Note: Functions are fully implemented but not deployed
    - _Note: Cloud Functions provide better scalability but require paid plan_


- [x] 37. Implement security and validation
  - [x] 37.1 Configure Firestore security rules
    - Write Firestore security rules in `firestore.rules`
    - Enforce authentication for all collections
    - Implement role-based read/write permissions
    - Make price_changes collection write-once (immutable)
    - Restrict transaction voids to transaction owner or admin
    - _Requirements: 1.4, 19.1, 19.2_

  - [x] 37.2 Configure Firebase Storage security rules
    - Write Storage security rules in `storage.rules`
    - Restrict upload permissions by role
    - Enforce file size limits
    - Validate file types (CSV, Excel, PDF only)
    - _Requirements: 19.1, 19.2_

  - [x] 37.3 Implement input validation
    - Create validation utilities in `src/utils/validation.ts`
    - Validate required fields, data types, formats
    - Validate numeric constraints (positive quantities, non-negative prices)
    - Validate SKU uniqueness
    - Validate price decimal places (max 2)
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6_

  - [x] 37.4 Implement security protection
    - Configure TLS 1.3 in Firebase hosting
    - Hash passwords using Firebase Auth built-in security
    - Implement CSRF token validation for state-changing operations
    - Log authentication attempts with IP addresses
    - _Requirements: 19.1, 19.3, 19.4, 19.5_


- [x] 38. Implement error handling and logging
  - [x] 38.1 Create error response utilities
    - Create error utilities in `src/utils/errors.ts`
    - Implement ErrorResponse interface
    - Create error factories for validation, parse, business logic errors
    - Generate unique request IDs for troubleshooting
    - _Requirements: 18.2_

  - [x] 38.2 Implement logging system
    - Create logging service in `src/services/logging/Logger.ts`
    - Implement log levels (DEBUG, INFO, WARN, ERROR, CRITICAL)
    - Log authentication attempts with failures
    - Log parse errors with file metadata
    - Log business rule violations and overrides
    - Log database errors with stack traces
    - _Requirements: 19.5_

  - [x] 38.3 Implement retry logic for transient failures
    - Create retry utility in `src/utils/retry.ts`
    - Implement exponential backoff for database operations
    - Apply retry logic to Firebase operations
    - _Requirements: 18.4_

  - [x] 38.4 Create global error boundary
    - Implement error boundary for unhandled exceptions
    - Display user-friendly error page
    - Log critical errors with full context
    - _Requirements: 18.2_


- [x] 39. Implement performance optimizations
  - [x] 39.1 Create Firestore indexes
    - Deploy composite indexes from `firestore.indexes.json`
    - Index: pricelist_items (supplierId, matchStatus, isNewProduct)
    - Index: price_changes (changeDate DESC, isSignificant)
    - Index: inventory_transactions (sku, timestamp DESC)
    - Index: pos_transactions (timestamp DESC, status)
    - Index: products (category, isActive)
    - _Requirements: 17.2, 22.4_

  - [x] 39.2 Implement caching for frequently accessed data
    - Cache product catalog locally in POS interface
    - Cache user permissions on session creation
    - Implement cache invalidation strategies
    - _Requirements: 13.1, 17.1_

  - [x] 39.3 Optimize query performance
    - Use Firestore queries with proper indexing
    - Limit query results with pagination
    - Use Firestore real-time listeners efficiently
    - Ensure queries return ≤1000 records within 2 seconds
    - _Requirements: 17.2_

- [x] 40. Implement usability enhancements
  - [x] 40.1 Add contextual help and tooltips
    - Add help tooltips to complex form fields
    - Implement keyboard shortcuts for frequent operations
    - Document shortcuts in help modal
    - _Requirements: 20.2, 20.4_

  
  - [x] 40.2 Ensure browser compatibility
    - Test on Chrome, Firefox, Edge, Safari
    - Implement polyfills if needed
    - Ensure responsive design for desktop resolutions
    - _Requirements: 20.5_

  - [x] 40.3 Add progress indicators
    - Display loading spinners for long operations
    - Show progress bars for file uploads and parsing
    - Display progress percentage for batch operations
    - _Requirements: 20.6_ 

- [x] 41. Deploy Firestore configuration
  - [x] 41.1 Deploy security rules
    - Deploy firestore.rules using Firebase CLI
    - Deploy storage.rules using Firebase CLI
    - Verify rules are active in Firebase Console
    - _Requirements: 19.1, 19.2_

  - [x] 41.2 Deploy Firestore indexes
    - Deploy firestore.indexes.json using Firebase CLI
    - Wait for index creation to complete
    - Verify indexes are built in Firebase Console
    - _Requirements: 17.2, 22.4_

  - [x] 41.3 Implement client-side function alternatives (Cloud Functions require Blaze plan)
    - Integrate pricelist processing into upload page (already done in task 25.1)
    - Add price change notifications to PriceMonitorService
    - Add low stock alert checks to InventoryService
    - Document the client-side approach as alternative to Cloud Functions
    - _Requirements: 3.5, 6.6, 8.4_
    - _Note: Cloud Functions folder preserved for future migration to Blaze plan_


- [ ] 42. Integration testing and validation
  - [x] 42.1 Write integration tests for authentication flow
    - Test complete login → access protected resource → logout flow
    - Test session expiration and redirect
    - Test account lockout after failed attempts
    - _Requirements: 1.1, 1.2, 1.5, 1.7, 19.6_

  - [x] 42.2 Write integration tests for pricelist processing
    - Test file upload → parse → match → price detection flow
    - Test with CSV, Excel, and PDF files
    - Verify data stored correctly in Firestore
    - _Requirements: 3.1, 3.2, 3.5, 4.1, 6.1_

  - [x] 42.3 Write integration tests for inventory operations
    - Test receiving → inventory update flow
    - Test POS transaction → inventory update flow
    - Test low stock alert generation
    - _Requirements: 8.2, 8.3, 8.4, 9.3, 13.3_

  - [x] 42.4 Write integration tests for POS operations
    - Test product lookup → add to cart → payment → transaction complete flow
    - Test transaction void → inventory reversal
    - Test offline queue → sync when online
    - _Requirements: 13.1, 13.2, 13.3, 13.5, 13.7_

  - [x] 42.5 Write integration tests for reporting
    - Test report generation with various filters
    - Test report export to PDF and Excel
    - Test report configuration save and reload
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.6_


- [x] 43. Performance and load testing
  - [x] 43.1 Validate performance requirements
    - Test UI response time <500ms for 95% of requests
    - Test database queries returning 1000 records within 2 seconds
    - Test pricelist processing with 10,000 items within 60 seconds
    - Test POS transaction completion within 5 seconds
    - Test dashboard rendering within 3 seconds
    - _Requirements: 17.1, 17.2, 3.4, 13.6, 14.7_

  - [x] 43.2 Test concurrent user load
    - Simulate 50 concurrent users
    - Verify no performance degradation
    - Monitor response times under load
    - _Requirements: 17.3_

  - [x] 43.3 Test scalability with large datasets
    - Load 100,000 product records
    - Load 1,000,000 transaction records
    - Verify query performance remains acceptable
    - _Requirements: 22.1, 22.2, 22.3, 22.4_

- [x] 44. Security testing
  - [x] 44.1 Test authentication security
    - Verify password hashing
    - Test account lockout mechanism
    - Verify session expiration
    - Test authentication logging
    - _Requirements: 19.3, 19.5, 19.6_

  
  - [x] 44.2 Test authorization and access control
    - Test role-based permissions enforcement
    - Verify Firestore security rulesth e
    - Test unauthorized access attempts
    - _Requirements: 1.3, 1.4_

  - [x] 44.3 Test data validation
    - Test input validation for all forms
    - Test SQL injection protection
    - Test XSS protection
    - Test CSRF protection
    - _Requirements: 19.4, 21.1, 21.2_

- [x] 45. Final checkpoint and system verification
  - Verify all core features are functional
  - Verify all performance requirements are met
  - Verify all security requirements are met
  - Run full test suite and ensure all tests pass
  - Ask the user if any questions or issues arise before final deployment



## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Property tests validate universal correctness properties from the design
- Unit tests and integration tests validate specific examples and edge cases
- The implementation uses TypeScript throughout for type safety
- Firebase provides managed infrastructure reducing operational complexity
- Astro's zero-JavaScript-by-default approach optimizes page load performance
- Interactive components (POS interface, product matching) use framework islands where needed
- Services follow dependency injection patterns for testability
- All parsers include corresponding pretty-printers for format conversion and round-trip validation


## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 1, "tasks": ["3.1", "17.1", "18.1", "19.1"] },
    { "id": 2, "tasks": ["3.2", "4.1", "4.2", "4.3", "5.1", "7.1", "7.2", "21.1", "21.2", "37.1", "37.2", "37.3", "37.4", "38.1"] },
    { "id": 3, "tasks": ["3.3", "4.4", "4.5", "5.2", "5.3", "7.3", "8.1", "9.1", "22.1", "38.2"] },
    { "id": 4, "tasks": ["4.6", "4.7", "4.8", "4.9", "7.4", "9.2", "11.1", "11.2", "12.1", "13.1", "16.1", "22.2", "38.3", "38.4"] },
    { "id": 5, "tasks": ["7.5", "7.6", "8.2", "9.3", "9.4", "11.3", "13.2", "13.3", "15.1", "16.2", "23.1", "24.1", "24.2", "39.1"] },
    { "id": 6, "tasks": ["11.4", "11.5", "12.2", "12.3", "15.2", "15.3", "16.3", "25.1", "25.2", "26.1", "26.2", "27.1", "28.1", "39.2"] },
    { "id": 7, "tasks": ["15.4", "15.5", "27.2", "28.2", "28.3", "29.1", "29.2", "30.1", "31.1", "32.1", "39.3", "40.1"] },
    { "id": 8, "tasks": ["29.3", "31.2", "32.2", "32.3", "33.1", "34.1", "34.2", "40.2", "40.3"] },
    { "id": 9, "tasks": ["33.2", "33.3", "34.3", "36.1", "36.2", "36.3"] },
    { "id": 10, "tasks": ["41.1", "41.2"] },
    { "id": 11, "tasks": ["41.3"] },
    { "id": 12, "tasks": ["42.1", "42.2", "42.3", "42.4", "42.5"] },
    { "id": 13, "tasks": ["43.1", "43.2", "43.3", "44.1", "44.2", "44.3"] }
  ]
}
```
