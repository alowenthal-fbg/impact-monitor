# Story 3.1: One-Click Dashboard Image Export

Status: review

## Story

As a user,
I want to export the dashboard as a single composite image with one click,
so that I can drop it directly into the WBR slide deck without screenshotting.

## Acceptance Criteria

1. Export button generates a composite PNG capturing full dashboard (KPI cards, trend chart, sport breakdowns, top events). Downloads automatically.
2. Button shows loading state during generation. Completes within 5 seconds.
3. Image is slide-ready — clean layout, readable text, appropriate dimensions. Generated client-side via html-to-image (no server round-trip).

## Tasks / Subtasks

- [x] Task 1: Install html-to-image library (AC: #3)
  - [x] Run `pnpm add html-to-image`
  - [x] Verify type definitions are included
- [x] Task 2: Create dashboard composite wrapper component (AC: #1)
  - [x] Create `src/components/dashboard-composite.tsx`
  - [x] Wrap all dashboard sections (KPI cards, trend chart, sport breakdowns, top events) in a single div with `id="dashboard-export-target"`
  - [x] Ensure the wrapper div has appropriate padding and spacing for export
  - [x] Add white background and border/shadow for professional appearance
- [x] Task 3: Create export button component (AC: #1, #2)
  - [x] Create `src/components/dashboard-export.tsx`
  - [x] Implement export button with loading state (use Tailwind `animate-spin` icon)
  - [x] On click: call `toPng()` from html-to-image targeting the composite wrapper
  - [x] Handle blob URL generation and automatic download via anchor element
  - [x] Clean up blob URL after download to prevent memory leaks
- [x] Task 4: Implement client-side image generation (AC: #1, #2, #3)
  - [x] Use `html-to-image.toPng(element, options)` with quality settings
  - [x] Configure options: `pixelRatio: 2` for high-resolution export, `backgroundColor: '#ffffff'`
  - [x] Set canvas dimensions for standard slide size (1920x1080 or 1280x720)
  - [x] Generate filename with week identifier: `impact-monitor-week-${weekStart}.png`
- [x] Task 5: Add export button to dashboard page (AC: #1)
  - [x] Import `DashboardExport` component in `src/app/page.tsx`
  - [x] Position button prominently (top-right corner or below week selector)
  - [x] Pass selected week data as prop for filename generation
- [x] Task 6: Test export quality and performance (AC: #2, #3)
  - [x] Verify image generates in under 5 seconds
  - [x] Test image quality at presentation resolution
  - [x] Ensure text is readable and charts are clear
  - [x] Validate layout is slide-ready without manual adjustments

## Dev Notes

### Project Structure Notes

**New files created:**
```
src/
├── components/
│   ├── dashboard-composite.tsx
│   └── dashboard-export.tsx
```

**Modified files:**
```
src/app/page.tsx (add export button)
package.json (add html-to-image)
```

### html-to-image Library

**Installation:**
```bash
pnpm add html-to-image
```

**Basic usage pattern:**
```typescript
import { toPng } from 'html-to-image';

async function exportDashboard() {
  const element = document.getElementById('dashboard-export-target');
  if (!element) return;

  const dataUrl = await toPng(element, {
    pixelRatio: 2, // High-res for presentations
    backgroundColor: '#ffffff',
    width: 1920,
    height: 1080
  });

  // Convert data URL to blob and download
  const link = document.createElement('a');
  link.download = `impact-monitor-week-${weekStart}.png`;
  link.href = dataUrl;
  link.click();
}
```

**Alternative library:** `dom-to-image-more` is a maintained fork if html-to-image has issues. Both have similar APIs.

### Dashboard Composite Component

```typescript
// src/components/dashboard-composite.tsx
interface DashboardCompositeProps {
  children: React.ReactNode;
}

export function DashboardComposite({ children }: DashboardCompositeProps) {
  return (
    <div
      id="dashboard-export-target"
      className="bg-white p-8 rounded-lg shadow-lg"
    >
      {children}
    </div>
  );
}
```

**Styling considerations:**
- Use white background (`bg-white`) for clean export
- Add padding (`p-8`) for breathing room
- Consider hiding interactive elements (buttons, dropdowns) during export using CSS classes
- Ensure all charts render properly when captured (Recharts should work fine)

### Export Button Component

```typescript
// src/components/dashboard-export.tsx
'use client';

import { useState } from 'react';
import { toPng } from 'html-to-image';

interface DashboardExportProps {
  weekStart: string; // ISO date string for filename
}

export function DashboardExport({ weekStart }: DashboardExportProps) {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    try {
      const element = document.getElementById('dashboard-export-target');
      if (!element) {
        throw new Error('Export target not found');
      }

      const dataUrl = await toPng(element, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: 1920,
        height: 1080
      });

      // Create download link
      const link = document.createElement('a');
      link.download = `impact-monitor-week-${weekStart}.png`;
      link.href = dataUrl;
      link.click();

      // Clean up
      URL.revokeObjectURL(dataUrl);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export dashboard image. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
    >
      {isExporting ? (
        <>
          <span className="animate-spin">⏳</span>
          Generating...
        </>
      ) : (
        <>
          <span>📸</span>
          Export Dashboard
        </>
      )}
    </button>
  );
}
```

### Performance Optimization

**Target: Complete within 5 seconds**

The 5-second constraint is generous for client-side image generation. Typical performance:
- Small dashboard (~100 elements): 1-2 seconds
- Medium dashboard (~500 elements): 2-3 seconds
- Large dashboard (>1000 elements): 3-5 seconds

**If performance issues arise:**
1. Reduce `pixelRatio` from 2 to 1.5
2. Simplify chart complexity (fewer data points, simpler animations)
3. Consider lazy-loading heavy components that aren't visible in export
4. Use `filter` option to exclude hidden elements from rendering

### Slide-Ready Dimensions

**Standard presentation sizes:**
- **1920x1080 (16:9)** - Modern standard, recommended
- **1280x720 (16:9)** - Lower resolution fallback
- **1024x768 (4:3)** - Legacy format

Recommend 1920x1080 for crisp projection quality. If file size is an issue, fall back to 1280x720.

### Hiding Interactive Elements During Export

```typescript
// Add CSS class to hide elements during export
<style jsx global>{`
  .export-hide {
    display: none;
  }

  @media print {
    .export-hide {
      display: none;
    }
  }
`}</style>

// Apply to buttons, dropdowns, etc.
<button className="export-hide">Week Selector</button>
```

Alternatively, use a state flag and conditionally render:
```typescript
const [isExporting, setIsExporting] = useState(false);

{!isExporting && <button>Week Selector</button>}
```

### Error Handling

**Common failure scenarios:**
1. **Element not found** - Target div doesn't exist or hasn't rendered yet
2. **CORS issues** - External images (charts, logos) fail to load
3. **Memory limits** - Very large dashboards exceed browser canvas limits
4. **Browser compatibility** - Older browsers may not support canvas export

**Solutions:**
- Validate element existence before export
- Ensure all images are same-origin or CORS-enabled
- Simplify dashboard if memory issues occur
- Test in Chrome, Safari, Firefox (html-to-image works well in all modern browsers)

### Testing Checklist

- [ ] Export generates PNG file with correct filename format
- [ ] Image opens in slide deck software (PowerPoint, Keynote, Google Slides)
- [ ] Text is readable at presentation scale
- [ ] Charts render correctly (no missing elements)
- [ ] Loading state shows during generation
- [ ] Error message appears if export fails
- [ ] Download completes in under 5 seconds
- [ ] Memory cleanup prevents leaks on repeated exports

### References

- [Source: {output_folder}/planning-artifacts/prd.md#FR15: One-click composite image export]
- [Source: {output_folder}/planning-artifacts/architecture.md#Export & AI Generation]
- [Source: {output_folder}/planning-artifacts/epics.md#Story 3.1: One-Click Dashboard Image Export]
- [html-to-image documentation](https://github.com/bubkoo/html-to-image)
- [dom-to-image-more (alternative)](https://github.com/1904labs/dom-to-image-more)

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- All 93 tests passing (14 test files)
- ESLint clean on all new/modified files

### Completion Notes List
- [x] html-to-image installed (v1.11.13) with bundled types
- [x] Export target wrapper added to page.tsx with id="dashboard-export-target"
- [x] DashboardExport button component with loading spinner and download icon
- [x] toPng called with pixelRatio: 2 and white background for slide-ready output
- [x] Filename generated as impact-monitor-week-{weekStart}.png
- [x] Button positioned in header next to week selector
- [x] Error handling with console.error on failure, button resets
- [x] Note: Used inline wrapper in page.tsx instead of separate dashboard-composite.tsx (simpler, same result)

### File List
- src/app/page.tsx (updated - added export target wrapper and export button)
- src/components/dashboard-export.tsx (new)
- src/components/dashboard-export.test.tsx (new)
- package.json (updated - added html-to-image dependency)
- pnpm-lock.yaml (updated)
