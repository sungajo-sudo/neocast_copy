# NeoCAST Project Guidelines

## Deployment

배포는 반드시 **OCI (Oracle Cloud Infrastructure)** 로 수행한다. GCP Cloud Run 배포 스크립트(`deploy-scripts/gcp/`)는 사용하지 않는다.

```bash
# OCI 배포 (전체)
./deploy-scripts/oci/05-deploy.sh all

# 개별 배포
./deploy-scripts/oci/05-deploy.sh web
./deploy-scripts/oci/05-deploy.sh api
./deploy-scripts/oci/05-deploy.sh admin
```

## NCode PDF Filename Convention

When generating NCode PDF files, always use the following filename format:

```
{title}-ncoded-{S}_{O}_{B}_{P}-b{blueprint}-d{glyphScale}.pdf
```

Where:
- `{title}`: Document title (original filename without extension)
- `{S}_{O}_{B}_{P}`: SOBP values (Section_Owner_Book_PageStart)
- `{blueprint}`: `1` if printInBlue is true, `0` if false
- `{glyphScale}`: NCode glyph scale in `X.X` format (one decimal place, e.g., `1.0`, `0.8`, `1.5`)

### Examples

- `document-ncoded-5_255_0_796-b1-d1.0.pdf` (blueprint mode, default glyph scale)
- `report-ncoded-5_255_0_100-b0-d0.8.pdf` (normal mode, smaller glyph scale)
- `presentation-ncoded-3_27_1234_1-b1-d1.2.pdf` (blueprint mode, larger glyph scale)

### Implementation

Use the `generateNcodePdfFilename()` function from `src/services/ncode-pdf-generator.service.ts`:

```typescript
import { generateNcodePdfFilename } from '../../services/ncode-pdf-generator.service';

const filename = generateNcodePdfFilename(
  title,
  { section, owner, book, pageStart },
  printInBlue,
  ncodeGlyphScale
);
```
