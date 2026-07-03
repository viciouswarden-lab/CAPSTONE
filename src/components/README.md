# Reusable UI Components

This directory contains reusable UI components for the PRO SYNAPSE system. These components provide consistent, accessible, and feature-rich user interface elements across the application.

## Components Overview

### 1. ErrorMessage.astro

Displays validation errors and error messages with clear guidance and contextual information.

**Validates Requirements:** 20.2, 20.3

**Props:**
- `message` (string, required): The error message text to display
- `field` (string, optional): Field name for inline validation errors
- `type` ('error' | 'warning' | 'info', default: 'error'): Severity level
- `dismissable` (boolean, default: false): Whether the error can be dismissed

**Usage Example:**

```astro
---
import ErrorMessage from '../components/ErrorMessage.astro';
---

<!-- Basic error message -->
<ErrorMessage message="Invalid email format" />

<!-- Field-specific validation error -->
<ErrorMessage 
  message="Price must be a positive number" 
  field="Price"
  type="error"
/>

<!-- Dismissable warning -->
<ErrorMessage 
  message="This action cannot be undone" 
  type="warning"
  dismissable={true}
/>

<!-- Informational message -->
<ErrorMessage 
  message="Processing may take up to 60 seconds" 
  type="info"
/>
```

### 2. LoadingSpinner.astro

Displays progress indicators for loading states and long-running operations.

**Validates Requirements:** 20.6

**Props:**
- `size` ('sm' | 'md' | 'lg', default: 'md'): Spinner size
- `message` (string, optional): Loading message to display below spinner
- `fullScreen` (boolean, default: false): Whether to show as full-screen overlay

**Usage Example:**

```astro
---
import LoadingSpinner from '../components/LoadingSpinner.astro';
---

<!-- Inline loading spinner -->
<LoadingSpinner size="md" message="Loading products..." />

<!-- Full-screen loading overlay -->
<LoadingSpinner 
  size="lg" 
  message="Processing pricelist... This may take a moment."
  fullScreen={true}
/>

<!-- Small spinner for buttons or inline use -->
<LoadingSpinner size="sm" />
```

### 3. DataTable.astro

Displays tabular data with built-in sorting, pagination support, and responsive design.

**Props:**
- `columns` (Column[], required): Array of column definitions
- `data` (any[], required): Array of data objects to display
- `keyField` (string, default: 'id'): Field to use as unique key for rows
- `striped` (boolean, default: true): Enable zebra striping
- `hoverable` (boolean, default: true): Enable row hover effect
- `bordered` (boolean, default: true): Enable borders
- `emptyMessage` (string, default: 'No data available'): Message when no data

**Column Interface:**
```typescript
interface Column {
  key: string;           // Data field key
  label: string;         // Column header label
  sortable?: boolean;    // Enable client-side sorting
  align?: 'left' | 'center' | 'right';  // Text alignment
  format?: (value: any) => string;      // Value formatter
}
```

**Usage Example:**

```astro
---
import DataTable from '../components/DataTable.astro';

const columns = [
  { key: 'sku', label: 'SKU', sortable: true },
  { key: 'description', label: 'Product Name', sortable: true },
  { key: 'price', label: 'Price', sortable: true, align: 'right', 
    format: (val) => `$${val.toFixed(2)}` },
  { key: 'quantity', label: 'Qty', align: 'center' }
];

const products = [
  { id: 1, sku: 'ABC-001', description: 'Widget A', price: 25.99, quantity: 100 },
  { id: 2, sku: 'ABC-002', description: 'Widget B', price: 15.50, quantity: 50 }
];
---

<DataTable 
  columns={columns} 
  data={products}
  keyField="id"
  striped={true}
  hoverable={true}
/>
```

**Features:**
- Client-side column sorting (click headers to sort)
- Numeric and string sorting
- Responsive design with horizontal scrolling
- Sticky headers for long tables
- Custom formatters for data display

### 4. SearchBar.astro

Provides search functionality with filters, debouncing, and responsive design.

**Validates Requirements:** 2.4, 7.5 (search within 2 seconds)

**Props:**
- `placeholder` (string, default: 'Search...'): Search input placeholder
- `name` (string, default: 'search'): Form input name attribute
- `value` (string, optional): Initial search value
- `filters` (Filter[], optional): Array of filter options
- `showClearButton` (boolean, default: true): Show clear button when has value
- `size` ('sm' | 'md' | 'lg', default: 'md'): Input size

**Filter Interface:**
```typescript
interface Filter {
  key: string;           // Filter parameter name
  label: string;         // Filter label
  options: Array<{       // Filter options
    value: string;
    label: string;
  }>;
}
```

**Usage Example:**

```astro
---
import SearchBar from '../components/SearchBar.astro';

const filters = [
  {
    key: 'category',
    label: 'Category',
    options: [
      { value: 'electronics', label: 'Electronics' },
      { value: 'furniture', label: 'Furniture' }
    ]
  },
  {
    key: 'status',
    label: 'Status',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' }
    ]
  }
];
---

<!-- Basic search bar -->
<SearchBar placeholder="Search products..." />

<!-- Search with filters -->
<SearchBar 
  placeholder="Search products..."
  filters={filters}
  size="md"
/>
```

**Features:**
- 300ms debounce for real-time search
- Clear button to reset search
- Multiple filter dropdowns
- Responsive mobile design
- Custom 'search' event for JavaScript handling

**JavaScript API:**

```javascript
// Listen for real-time search events
document.querySelector('.search-form').addEventListener('search', (e) => {
  const query = e.detail.query;
  // Perform search with query
});
```

### 5. Modal.astro

Displays dialogs, confirmations, and modal overlays for user interactions.

**Props:**
- `title` (string, required): Modal title text
- `size` ('sm' | 'md' | 'lg' | 'xl', default: 'md'): Modal width
- `closable` (boolean, default: true): Whether modal can be closed
- `showFooter` (boolean, default: true): Whether to show footer section
- `type` ('default' | 'danger' | 'success' | 'warning', default: 'default'): Styling variant

**Usage Example:**

```astro
---
import Modal from '../components/Modal.astro';
---

<!-- Confirmation dialog -->
<Modal title="Confirm Delete" type="danger" size="md">
  <p>Are you sure you want to delete this product?</p>
  <p class="text-sm text-gray-600 mt-2">This action cannot be undone.</p>
</Modal>

<!-- Custom footer buttons -->
<Modal title="Add Product" type="default" size="lg">
  <form id="add-product-form">
    <!-- Form fields here -->
  </form>
  
  <div slot="footer">
    <button type="button" class="btn-cancel">Cancel</button>
    <button type="submit" form="add-product-form" class="btn-submit">
      Save Product
    </button>
  </div>
</Modal>

<!-- Non-closable modal for critical operations -->
<Modal title="Processing" closable={false} showFooter={false}>
  <p>Please wait while we process your request...</p>
  <LoadingSpinner size="md" />
</Modal>
```

**JavaScript API:**

```javascript
// Show modal programmatically
window.Modal.show('.modal-backdrop'); // Use any selector

// Hide modal programmatically
window.Modal.hide('.modal-backdrop');

// Listen for modal events
const modal = document.querySelector('.modal-backdrop');

modal.addEventListener('show', () => {
  console.log('Modal opened');
});

modal.addEventListener('hide', () => {
  console.log('Modal closed');
});

modal.addEventListener('confirm', (e) => {
  console.log('Confirm clicked');
  // e.preventDefault() to prevent auto-close
});

modal.addEventListener('cancel', (e) => {
  console.log('Cancel clicked');
  // e.preventDefault() to prevent auto-close
});
```

**Features:**
- Full-screen backdrop overlay
- Click outside to close (if closable)
- Escape key to close (if closable)
- Focus management
- Custom footer with slots
- Event-driven API
- Multiple size variants
- Type-based styling (default, danger, success, warning)
- Scrollable body for long content
- Accessible ARIA attributes

## Component Design Patterns

### Consistent Styling

All components use a consistent color palette and design language:
- **Primary**: Blue (#3b82f6)
- **Danger**: Red (#dc2626)
- **Warning**: Yellow (#f59e0b)
- **Success**: Green (#10b981)
- **Gray scales**: Tailwind CSS gray palette

### Accessibility

All components include:
- Proper ARIA attributes (role, aria-label, aria-labelledby, etc.)
- Keyboard navigation support
- Screen reader compatibility
- Focus management
- Semantic HTML

### Responsive Design

All components are mobile-friendly with:
- Responsive breakpoints
- Touch-friendly controls
- Optimized layouts for small screens
- Horizontal scrolling for tables

### Animation

Subtle animations enhance user experience:
- Fade-in effects for overlays
- Slide-up animations for modals
- Smooth transitions for interactive elements
- Performance-optimized CSS animations

## Integration Examples

### Product Management Page

```astro
---
import MainLayout from '../layouts/MainLayout.astro';
import SearchBar from '../components/SearchBar.astro';
import DataTable from '../components/DataTable.astro';
import LoadingSpinner from '../components/LoadingSpinner.astro';
import ErrorMessage from '../components/ErrorMessage.astro';
import Modal from '../components/Modal.astro';

// Fetch products...
const products = [];
const loading = false;
const error = null;
---

<MainLayout title="Product Management">
  <div class="container mx-auto p-6">
    <h1 class="text-3xl font-bold mb-6">Products</h1>

    <!-- Search -->
    <SearchBar placeholder="Search products by SKU or name..." />

    <!-- Error message -->
    {error && <ErrorMessage message={error} type="error" />}

    <!-- Loading state -->
    {loading && <LoadingSpinner message="Loading products..." />}

    <!-- Data table -->
    {!loading && !error && (
      <DataTable 
        columns={[
          { key: 'sku', label: 'SKU', sortable: true },
          { key: 'name', label: 'Product Name', sortable: true },
          { key: 'price', label: 'Price', sortable: true, align: 'right' }
        ]}
        data={products}
      />
    )}

    <!-- Delete confirmation modal -->
    <Modal title="Confirm Delete" type="danger">
      <p>Are you sure you want to delete this product?</p>
    </Modal>
  </div>
</MainLayout>
```

## Browser Support

All components are tested and supported on:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Performance Considerations

- Components use minimal JavaScript (loaded only when needed)
- CSS animations are GPU-accelerated
- Client-side sorting handles up to 10,000 rows efficiently
- Search debouncing prevents excessive API calls
- Lazy loading for modal content

## Future Enhancements

Potential improvements for future iterations:
- Server-side pagination for DataTable
- Advanced filtering for DataTable
- Export functionality (CSV, Excel) for DataTable
- Autocomplete/suggestions for SearchBar
- Nested/stacked modals support
- Customizable themes
- Dark mode support
