# Task 33.3 Manual Testing Guide

## Test Report Configuration Saving Feature

### Prerequisites
1. Ensure Firebase is configured and connected
2. User must be logged in with at least "Analyst" role
3. Navigate to `/reports` page

---

## Test Case 1: Save a Sales Report Configuration

### Steps:
1. Navigate to `/reports`
2. Select "Sales Report" from Report Type dropdown
3. Set date range: Start Date = 30 days ago, End Date = today
4. Select "Product" from Group By dropdown
5. Check "Include margin calculations"
6. Enter SKU filter (optional): "TEST-001"
7. Click "Save Configuration" button (appears after selecting report type)
8. Enter name: "My Sales Report"
9. Click OK in the prompt

### Expected Results:
- ✅ Configuration is saved successfully
- ✅ Alert shows "Configuration saved successfully!"
- ✅ New configuration appears in "Saved Configurations" section
- ✅ Configuration card shows:
  - Name: "My Sales Report"
  - Type: "Sales Report"
  - Last used date

---

## Test Case 2: Load a Saved Configuration

### Steps:
1. In the "Saved Configurations" section
2. Find the configuration saved in Test Case 1
3. Click "Load" button

### Expected Results:
- ✅ Alert shows "Configuration loaded successfully!"
- ✅ Page scrolls to report form
- ✅ Report Type is set to "Sales Report"
- ✅ Sales config section is visible
- ✅ Date range fields are populated correctly
- ✅ Group By is set to "Product"
- ✅ "Include margin calculations" is checked
- ✅ SKU filter shows "TEST-001"

---

## Test Case 3: Generate Report from Loaded Configuration

### Steps:
1. After loading configuration from Test Case 2
2. Click "Generate Report" button
3. Wait for report to generate

### Expected Results:
- ✅ Report generates successfully
- ✅ Report displays sales data grouped by product
- ✅ Margin column is visible in the report table
- ✅ Report summary shows total revenue and margin
- ✅ Generation time is displayed

---

## Test Case 4: Save an Inventory Report Configuration

### Steps:
1. Navigate to `/reports` (or click "New Report")
2. Select "Inventory Report" from Report Type dropdown
3. Set date range
4. Check "Include inventory value calculations"
5. Check "Include turnover rate calculations"
6. Check "Show low stock items only"
7. Enter location filter: "WAREHOUSE-A"
8. Click "Save Configuration"
9. Enter name: "Low Stock Report"

### Expected Results:
- ✅ Configuration is saved
- ✅ Appears in saved configurations list
- ✅ Shows "Inventory Report" type

---

## Test Case 5: Save a Supplier Performance Report Configuration

### Steps:
1. Navigate to `/reports`
2. Select "Supplier Performance Report"
3. Set date range
4. Check metrics: "Price Stability" and "Delivery Reliability"
5. Uncheck "Product Range"
6. Enter supplier filter: "SUP-001"
7. Click "Save Configuration"
8. Enter name: "Supplier Quality Metrics"

### Expected Results:
- ✅ Configuration is saved
- ✅ Appears in saved configurations list
- ✅ Shows "Supplier Report" type

---

## Test Case 6: Load and Verify Inventory Configuration

### Steps:
1. Find "Low Stock Report" in saved configurations
2. Click "Load"
3. Verify all settings are restored

### Expected Results:
- ✅ Report Type: "Inventory Report"
- ✅ "Include inventory value" is checked
- ✅ "Include turnover rate" is checked
- ✅ "Show low stock items only" is checked
- ✅ Location filter shows "WAREHOUSE-A"

---

## Test Case 7: Load and Verify Supplier Configuration

### Steps:
1. Find "Supplier Quality Metrics" in saved configurations
2. Click "Load"
3. Verify all settings are restored

### Expected Results:
- ✅ Report Type: "Supplier Performance Report"
- ✅ "Price Stability" is checked
- ✅ "Delivery Reliability" is checked
- ✅ "Product Range" is unchecked
- ✅ Supplier filter shows "SUP-001"

---

## Test Case 8: Delete a Configuration

### Steps:
1. Find any saved configuration
2. Click "Delete" button
3. Confirm deletion in the confirmation dialog

### Expected Results:
- ✅ Confirmation dialog appears
- ✅ After confirming, alert shows "Configuration deleted successfully!"
- ✅ Configuration is removed from the list
- ✅ Configuration cannot be loaded anymore

---

## Test Case 9: Multiple Configurations Management

### Steps:
1. Create 3 different configurations:
   - "Weekly Sales" (Sales report)
   - "Stock Levels" (Inventory report)
   - "Supplier Review" (Supplier report)
2. Verify all appear in the list
3. Load each one to verify they're different
4. Delete one
5. Verify the other two remain

### Expected Results:
- ✅ All 3 configurations are saved
- ✅ All appear in saved configurations section
- ✅ Each loads with correct settings
- ✅ Deleting one doesn't affect others
- ✅ Configurations are sorted by last used (most recent first)

---

## Test Case 10: Configuration Persistence

### Steps:
1. Save a configuration "Persistence Test"
2. Logout
3. Login again with the same user
4. Navigate to `/reports`
5. Check saved configurations

### Expected Results:
- ✅ "Persistence Test" configuration is still visible
- ✅ Can load and use the configuration
- ✅ Last used date is from previous session

---

## Test Case 11: User Isolation

### Steps:
1. Login as User A
2. Save configuration "User A Config"
3. Logout
4. Login as User B
5. Navigate to `/reports`
6. Check saved configurations

### Expected Results:
- ✅ User B does NOT see "User A Config"
- ✅ User B can only see their own configurations
- ✅ User B cannot access or delete User A's configurations

---

## Test Case 12: Empty State

### Steps:
1. Login with a new user (or delete all configurations)
2. Navigate to `/reports`
3. Check saved configurations section

### Expected Results:
- ✅ Message displays: "No saved configurations yet."
- ✅ No configuration cards are shown
- ✅ Save button still works to create first configuration

---

## Test Case 13: Configuration Name Validation

### Steps:
1. Select a report type
2. Click "Save Configuration"
3. Leave name blank or enter only spaces
4. Click OK

### Expected Results:
- ✅ Configuration is NOT saved (empty name validation)
- ✅ No error occurs
- ✅ Can try again with valid name

---

## Test Case 14: Load Configuration and Modify

### Steps:
1. Load a saved configuration
2. Modify some settings (change date range, add filter)
3. Generate report with modified settings
4. Save as new configuration with different name

### Expected Results:
- ✅ Can modify loaded configuration
- ✅ Report generates with modified settings
- ✅ Can save modified version as new configuration
- ✅ Both configurations exist independently

---

## Test Case 15: Last Used Timestamp Update

### Steps:
1. Save a configuration "Timestamp Test"
2. Note the "Last used" date
3. Wait a few seconds
4. Load the configuration
5. Check saved configurations list again

### Expected Results:
- ✅ "Last used" timestamp is updated
- ✅ Configuration moves to top of list (if sorted by last used)
- ✅ Timestamp shows current date/time

---

## Test Case 16: Form State Before Save

### Steps:
1. Navigate to `/reports`
2. Don't select any report type
3. Try to click "Save Configuration" button

### Expected Results:
- ✅ "Save Configuration" button is hidden
- ✅ Button only appears after selecting report type
- ✅ Alert shows "Please select a report type first." if button is somehow clicked

---

## Test Case 17: API Error Handling

### Steps:
1. Disable network (simulate offline)
2. Try to save a configuration
3. Re-enable network
4. Try again

### Expected Results:
- ✅ When offline: Alert shows "Failed to save configuration."
- ✅ When online: Configuration saves successfully
- ✅ No data corruption occurs

---

## Test Case 18: Configuration with All Filters

### Steps:
1. Create a sales report with:
   - All date fields filled
   - Group by: Month
   - Include margin: checked
   - SKU filter: "ABC-123"
   - Category filter: "Electronics"
2. Save as "Complete Sales Config"
3. Load the configuration
4. Verify all fields

### Expected Results:
- ✅ All fields are saved correctly
- ✅ All fields are restored correctly
- ✅ No data loss in filters
- ✅ Report can be generated with all filters applied

---

## Test Case 19: Rapid Save/Load/Delete

### Steps:
1. Quickly save 5 configurations
2. Quickly load each one
3. Quickly delete all 5

### Expected Results:
- ✅ All operations complete successfully
- ✅ No race conditions or errors
- ✅ UI updates correctly
- ✅ No stale data shown

---

## Test Case 20: Configuration Size Limits

### Steps:
1. Create a configuration with very long name (200+ characters)
2. Create a configuration with many filters

### Expected Results:
- ✅ Long names are saved (but may be truncated in display)
- ✅ Multiple filters are saved correctly
- ✅ No truncation of actual configuration data
- ✅ UI handles long names gracefully

---

## Browser Compatibility Testing

Test the above scenarios in:
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Edge (latest)
- ✅ Safari (latest, if on Mac)

---

## Performance Testing

### Metrics to Monitor:
- Save configuration: < 500ms
- Load configuration: < 300ms
- List configurations: < 500ms
- Delete configuration: < 500ms

### Test with:
- 1 configuration
- 10 configurations
- 50 configurations

**Expected:** Performance should remain acceptable even with 50+ configurations.

---

## Accessibility Testing

1. Navigate using keyboard only (Tab, Enter, Space)
2. Use screen reader to verify labels
3. Check color contrast for all buttons and text

### Expected:
- ✅ All interactive elements are keyboard accessible
- ✅ Screen reader announces all actions
- ✅ Color contrast meets WCAG AA standards

---

## Mobile Responsiveness Testing

Test on mobile devices or browser dev tools:
- iPhone (Safari)
- Android (Chrome)
- Tablet (iPad)

### Expected:
- ✅ Configuration cards stack vertically
- ✅ Buttons are touch-friendly
- ✅ Form is fully usable
- ✅ No horizontal scrolling

---

## Summary

After completing all test cases, verify:

1. ✅ Users can save configurations
2. ✅ Users can load configurations
3. ✅ Users can delete configurations
4. ✅ Configurations persist across sessions
5. ✅ Users only see their own configurations
6. ✅ All report types work correctly
7. ✅ All filters and options are saved/restored
8. ✅ UI is responsive and user-friendly
9. ✅ Error handling is graceful
10. ✅ Performance is acceptable

**Task 33.3 Status: COMPLETE ✅**

All functionality for report configuration saving, loading, displaying, and managing has been successfully implemented and is ready for testing.
