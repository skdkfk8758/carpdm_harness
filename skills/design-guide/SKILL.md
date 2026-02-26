---
name: harness-design-guide
description: 디자인 시스템 선택 및 적용 가이드. "카본으로 해줘", "머티리얼 디자인", "디자인 시스템 추천" 등을 요청할 때 사용합니다.
---

# Design System Guide

바이브코딩 시 디자인 시스템을 빠르게 선택하고 적용하기 위한 레퍼런스입니다.
사용자가 디자인 시스템 이름을 언급하면 해당 섹션을 참조하여 즉시 구현에 반영하세요.

## 시스템 선택 로직

1. 사용자가 **디자인 시스템 이름을 명시**한 경우 → 해당 섹션으로 직행
2. 사용자가 **"추천해줘"**만 한 경우 → 프로젝트 성격별 추천:

| 프로젝트 성격 | 추천 시스템 | 이유 |
|---------------|-------------|------|
| 엔터프라이즈/관리자 대시보드 | IBM Carbon | 데이터 시각화 + 정보 밀도 최적화 |
| 일반 웹앱/모바일 | Material Design | 가장 넓은 생태계 + 러닝커브 낮음 |
| 이커머스 관리자 | Shopify Polaris | 상거래 UX 패턴 내장 |
| macOS/iOS 네이티브 느낌 | Apple HIG | 네이티브 일관성 |
| 크리에이티브/미디어 | Adobe Spectrum | 크리에이티브 워크플로우 최적화 |
| CRM/B2B SaaS | Salesforce Lightning | CRM 패턴 내장 |
| 협업/프로젝트 관리 | Atlassian Design | 복잡한 워크스페이스 패턴 |
| 개발자 도구 | GitHub Primer | 개발자 친화적 + 코드 표현 최적화 |
| 대규모 플랫폼 | Uber Base | 극단적 확장성 |
| 브랜드 경험 중심 | Airbnb DLS | 감성적 비주얼 |
| Windows/크로스플랫폼 | Fluent Design | Windows 생태계 통합 |

3. 여러 시스템이 동시에 언급된 경우 → "하나만 선택해주세요" 안내 (혼합 사용 비권장)

## Context7 연동

최신 API/컴포넌트 문서가 필요하면 Context7 MCP 도구를 활용하세요:
```tool
mcp__context7__resolve-library-id({ libraryName: "<패키지명>" })
mcp__context7__query-docs({ libraryId: "<resolved-id>", topic: "<컴포넌트명>" })
```

---

## 1. Google Material Design (머티리얼 디자인)

> 레이어와 모션 기반의 일관된 UI 시스템. 가장 넓은 생태계.

### 패키지
```bash
# React (MUI)
npm install @mui/material @emotion/react @emotion/styled
# 아이콘
npm install @mui/icons-material
# 폰트
# index.html에 추가: <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
```

### 핵심 토큰
- **Primary**: `#6750A4` (M3) / 프로젝트별 커스텀 가능
- **Font**: Roboto (기본), 한글: Noto Sans KR
- **Spacing**: 4px 기준 (4, 8, 12, 16, 24, 32, 48)
- **Border Radius**: 4px (small), 8px (medium), 16px (large), 28px (full)
- **Elevation**: 5단계 (0dp~24dp, 그림자로 표현)

### 그리드
- 12 컬럼, gutter 16~24px
- Breakpoints: xs(0), sm(600), md(900), lg(1200), xl(1536)

### 컴포넌트 패턴
```tsx
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { Button, Card, CardContent, Typography, AppBar, Toolbar } from '@mui/material';

const theme = createTheme({
  palette: { primary: { main: '#6750A4' } },
  typography: { fontFamily: '"Roboto", "Noto Sans KR", sans-serif' },
});

// 항상 ThemeProvider + CssBaseline으로 감싸기
<ThemeProvider theme={theme}>
  <CssBaseline />
  {children}
</ThemeProvider>
```

### 참조
- 공식: https://m3.material.io
- MUI: https://mui.com/material-ui/getting-started/

---

## 2. Apple Human Interface Guidelines (HIG)

> 미니멀하고 콘텐츠 중심. iOS/macOS 네이티브 느낌.

### 패키지
```bash
# 웹에서 HIG 스타일 구현 시
npm install @headlessui/react  # 접근성 기반 컴포넌트
# SF Pro 폰트는 Apple 개발자 사이트에서 다운로드
# 또는 시스템 폰트 스택 사용
```

### 핵심 토큰
- **Primary**: `#007AFF` (iOS Blue)
- **Font**: SF Pro (시스템), 한글: Apple SD Gothic Neo
- **Font Stack**: `-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif`
- **Spacing**: 8px 기준 (8, 16, 20, 24, 32)
- **Border Radius**: 10px (카드), 12px (버튼), 22px (검색바)
- **Blur**: `backdrop-filter: blur(20px)` (글래스모피즘)

### 그리드
- 유동적 레이아웃, 고정 컬럼 수 없음
- 좌우 마진: 16px (compact), 20px (regular)
- Safe Area 준수

### 컴포넌트 패턴
```css
/* Apple HIG 글래스모피즘 기본 */
.card {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 10px;
  border: 0.5px solid rgba(0, 0, 0, 0.1);
}
.button-primary {
  background: #007AFF;
  color: white;
  border-radius: 12px;
  padding: 12px 20px;
  font-weight: 600;
}
```

### 참조
- 공식: https://developer.apple.com/design/human-interface-guidelines/

---

## 3. Microsoft Fluent Design

> 빛, 깊이, 모션을 활용한 공간감 디자인. Windows 생태계.

### 패키지
```bash
# React
npm install @fluentui/react-components
# 아이콘
npm install @fluentui/react-icons
```

### 핵심 토큰
- **Primary**: `#0078D4` (Microsoft Blue)
- **Font**: Segoe UI (Windows), 한글: Malgun Gothic
- **Font Stack**: `"Segoe UI", "Malgun Gothic", sans-serif`
- **Spacing**: 4px 기준 (4, 8, 12, 16, 20, 24, 32)
- **Border Radius**: 2px (subtle), 4px (medium), 8px (large)
- **Acrylic**: `backdrop-filter: blur(30px)` + noise texture

### 그리드
- 12 컬럼, gutter 16px
- Breakpoints: sm(320), md(480), lg(640), xl(1024), xxl(1366)

### 컴포넌트 패턴
```tsx
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { Button, Card, Text } from '@fluentui/react-components';

<FluentProvider theme={webLightTheme}>
  <Card>
    <Text weight="semibold" size={500}>Title</Text>
    <Button appearance="primary">Action</Button>
  </Card>
</FluentProvider>
```

### 참조
- 공식: https://fluent2.microsoft.design
- React: https://react.fluentui.dev

---

## 4. IBM Carbon (카본)

> 데이터 중심 엔터프라이즈 UI. 정보 밀도와 접근성 최적화.

### 패키지
```bash
# React
npm install @carbon/react
# 스타일 (Sass 필수)
npm install sass
```

### 핵심 토큰
- **Primary**: `#0f62fe` (Blue 60)
- **Font**: IBM Plex Sans, 한글: IBM Plex Sans KR
- **Spacing**: 2-point grid (2, 4, 8, 12, 16, 24, 32, 40, 48)
- **Border Radius**: 0px (기본 — 날카로운 직각이 Carbon 정체성)
- **테마**: White, g10 (light gray), g90 (dark gray), g100 (dark)

### 그리드
- 16 컬럼 (wide), gutter 32px
- Breakpoints: sm(320), md(672), lg(1056), xl(1312), max(1584)
- `<Grid>` + `<Column>` 패턴

### 컴포넌트 패턴
```tsx
import { Theme, Grid, Column, Button, DataTable, Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@carbon/react';
import '@carbon/react/scss/grid';

// 테마 적용
<Theme theme="g10">
  <Grid>
    <Column lg={16} md={8} sm={4}>
      <DataTable rows={rows} headers={headers}>
        {/* Carbon DataTable은 정렬, 필터, 페이지네이션 내장 */}
      </DataTable>
    </Column>
  </Grid>
</Theme>
```

### 참조
- 공식: https://carbondesignsystem.com
- React: https://react.carbondesignsystem.com

---

## 5. Shopify Polaris (폴라리스)

> 이커머스 관리자 최적화. 상거래 UX 패턴 내장.

### 패키지
```bash
npm install @shopify/polaris
# CSS 임포트 필수
# import '@shopify/polaris/build/esm/styles.css';
```

### 핵심 토큰
- **Primary**: `#008060` (Shopify Green)
- **Font**: Inter (기본)
- **Spacing**: 4px 기준 (4, 8, 12, 16, 20, 24, 32)
- **Border Radius**: 8px (카드), 6px (버튼), 4px (인풋)
- **그림자**: `shadow-sm`, `shadow-md`, `shadow-lg`

### 그리드
- CSS Grid 기반, 유동적
- `<Layout>` + `<Layout.Section>` 패턴
- 반응형: 단일 컬럼 ↔ 다중 컬럼 자동 전환

### 컴포넌트 패턴
```tsx
import { AppProvider, Page, Layout, Card, Button, DataTable, Badge } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';

<AppProvider i18n={{}}>
  <Page title="Orders" primaryAction={{ content: 'Create order' }}>
    <Layout>
      <Layout.Section>
        <Card>
          <DataTable
            columnContentTypes={['text', 'numeric', 'numeric']}
            headings={['Product', 'Price', 'Qty']}
            rows={rows}
          />
        </Card>
      </Layout.Section>
      <Layout.Section variant="oneThird">
        <Card><Badge status="success">Active</Badge></Card>
      </Layout.Section>
    </Layout>
  </Page>
</AppProvider>
```

### 참조
- 공식: https://polaris.shopify.com

---

## 6. Airbnb DLS

> 브랜드 경험 중심. 감성적 비주얼과 여백의 미학.

### 패키지
```bash
# Airbnb DLS는 공개 npm 패키지가 없음
# 스타일 가이드를 참조하여 직접 구현 (Tailwind CSS 추천)
npm install tailwindcss
# 또는 react-dates (Airbnb가 만든 날짜 선택기)
npm install react-dates moment
```

### 핵심 토큰
- **Primary**: `#FF5A5F` (Rausch — Airbnb Red)
- **Secondary**: `#00A699` (Kazan — Teal)
- **Neutral**: `#484848` (Hof — Dark Gray)
- **Font**: Cereal (커스텀), 대체: Circular Std, 한글: Noto Sans KR
- **Font Stack**: `"Cereal", "Circular Std", "Noto Sans KR", sans-serif`
- **Spacing**: 8px 기준 (8, 16, 24, 32, 48, 64)
- **Border Radius**: 8px (카드), 12px (버튼), 50% (아바타)

### 컴포넌트 패턴
```css
/* Airbnb 스타일 카드 */
.listing-card {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: box-shadow 0.2s;
}
.listing-card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.16);
}
/* 큰 여백, 부드러운 곡선, 큰 이미지 비율(3:2) */
.listing-image { aspect-ratio: 3/2; object-fit: cover; }
```

### 참조
- 참고: https://airbnb.design

---

## 7. Atlassian Design System

> 협업 도구 최적화. 복잡한 워크스페이스와 상태 관리 패턴.

### 패키지
```bash
npm install @atlaskit/button @atlaskit/page @atlaskit/dynamic-table
npm install @atlaskit/css-reset @atlaskit/theme
# 컴포넌트별 개별 설치 (tree-shaking 최적화)
```

### 핵심 토큰
- **Primary**: `#0052CC` (Atlassian Blue)
- **Font**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Spacing**: 8px 기준 (4, 8, 12, 16, 20, 24, 32, 40)
- **Border Radius**: 3px (기본 — 미묘한 둥글림)
- **색상 체계**: Design Token 기반 (`--ds-background-brand-bold`)

### 그리드
- Flexbox 기반, `<Grid>` + `<GridColumn>`
- 사이드바(240px) + 메인 콘텐츠 패턴

### 컴포넌트 패턴
```tsx
import Button from '@atlaskit/button';
import DynamicTable from '@atlaskit/dynamic-table';
import Lozenge from '@atlaskit/lozenge';
import '@atlaskit/css-reset';

// 상태 표현: Lozenge (라벨)
<Lozenge appearance="success">Done</Lozenge>
<Lozenge appearance="inprogress">In Progress</Lozenge>
<Lozenge appearance="new">To Do</Lozenge>

// 보드/리스트 전환, 칸반, 타임라인 등 복잡한 레이아웃 지원
```

### 참조
- 공식: https://atlassian.design

---

## 8. Salesforce Lightning

> CRM 특화 기업형 UI. 데이터 테이블과 폼 중심.

### 패키지
```bash
# Lightning Web Components (LWC) — Salesforce 플랫폼 전용
# 웹 범용 사용 시 SLDS (Lightning Design System) CSS
npm install @salesforce-ux/design-system
# React 바인딩
npm install @salesforce/design-system-react
```

### 핵심 토큰
- **Primary**: `#1589EE` → `#0176D3` (최신)
- **Font**: Salesforce Sans, 대체: `"Salesforce Sans", Arial, sans-serif`
- **Spacing**: 4px 기준 (4, 8, 12, 16, 24, 32)
- **Border Radius**: 4px (기본)
- **특징**: Blueprint 패턴 (레코드 홈, 리스트 뷰, 상세 페이지)

### 컴포넌트 패턴
```html
<!-- SLDS CSS 클래스 기반 -->
<div class="slds-page-header">
  <div class="slds-page-header__row">
    <div class="slds-page-header__col-title">
      <h1 class="slds-page-header__title">Accounts</h1>
    </div>
  </div>
</div>
<table class="slds-table slds-table_bordered slds-table_cell-buffer">
  <!-- 데이터 중심 테이블 -->
</table>
```

### 참조
- 공식: https://www.lightningdesignsystem.com

---

## 9. Adobe Spectrum

> 크리에이티브 툴 확장형. 세밀한 컨트롤과 다크모드 최적화.

### 패키지
```bash
# React
npm install @adobe/react-spectrum
# 개별 컴포넌트
npm install @react-spectrum/button @react-spectrum/textfield
```

### 핵심 토큰
- **Primary**: `#1473E6` (Spectrum Blue)
- **Font**: Adobe Clean, 대체: `"Adobe Clean", "Source Sans Pro", sans-serif`
- **Spacing**: 8px 기준 (4, 8, 12, 16, 24, 32, 40, 48)
- **Border Radius**: 4px (기본), 16px (카드)
- **테마**: Light, Dark, Darkest (크리에이티브 툴용)
- **스케일**: Medium (데스크톱), Large (터치)

### 컴포넌트 패턴
```tsx
import { Provider, defaultTheme } from '@adobe/react-spectrum';
import { Button, TextField, Flex, View } from '@adobe/react-spectrum';

<Provider theme={defaultTheme} colorScheme="dark">
  <View padding="size-200">
    <Flex direction="column" gap="size-150">
      <TextField label="Layer name" />
      <Button variant="cta">Apply</Button>
    </Flex>
  </View>
</Provider>
```

### 참조
- 공식: https://spectrum.adobe.com
- React: https://react-spectrum.adobe.com

---

## 10. Uber Base (베이스)

> 대규모 서비스 확장 중심. 미니멀하고 기능적.

### 패키지
```bash
npm install baseui styletron-engine-monolithic styletron-react
```

### 핵심 토큰
- **Primary**: `#000000` (Black — Uber의 정체성)
- **Accent**: `#276EF1` (Blue)
- **Font**: `"Uber Move", "Helvetica Neue", Arial, sans-serif`
- **Spacing**: 4px 기준 (scale0~scale4800)
- **Border Radius**: 8px (기본), 36px (pill)

### 그리드
- Flexbox `<FlexGrid>`, 12 컬럼
- Breakpoints: sm(320), md(600), lg(1280)

### 컴포넌트 패턴
```tsx
import { Client as Styletron } from 'styletron-engine-monolithic';
import { Provider as StyletronProvider } from 'styletron-react';
import { LightTheme, BaseProvider, Button, Card, HeadingSmall } from 'baseui';

const engine = new Styletron();

<StyletronProvider value={engine}>
  <BaseProvider theme={LightTheme}>
    <Card>
      <HeadingSmall>Trip summary</HeadingSmall>
      <Button>Request ride</Button>
    </Card>
  </BaseProvider>
</StyletronProvider>
```

### 참조
- 공식: https://baseweb.design

---

## 11. GitHub Primer (프라이머)

> 개발 협업 최적화. 코드 표현과 개발자 UX 특화.

### 패키지
```bash
# React
npm install @primer/react
# CSS만
npm install @primer/css
# 아이콘
npm install @primer/octicons-react
```

### 핵심 토큰
- **Primary**: `#0969DA` → `#0550AE` (Primer Blue)
- **Success**: `#1A7F37`, **Danger**: `#CF222E`, **Warning**: `#9A6700`
- **Font**: `-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif`
- **Monospace**: `"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace`
- **Spacing**: 4px 기준 (0, 4, 8, 16, 24, 32, 40, 48)
- **Border Radius**: 6px (기본), 100px (pill)
- **테마**: Light, Dark, Dark dimmed, Dark high contrast

### 컴포넌트 패턴
```tsx
import { ThemeProvider, BaseStyles, Button, Box, Text, Label, StateLabel, CounterLabel } from '@primer/react';
import { MarkGithubIcon } from '@primer/octicons-react';

<ThemeProvider>
  <BaseStyles>
    <Box p={3} bg="canvas.default">
      <Label variant="success">Merged</Label>
      <StateLabel status="issueOpened">Open</StateLabel>
      <Button variant="primary" leadingVisual={MarkGithubIcon}>
        Create repository
      </Button>
    </Box>
  </BaseStyles>
</ThemeProvider>
```

### 참조
- 공식: https://primer.style
- React: https://primer.style/react

---

## 공통 적용 체크리스트

디자인 시스템 적용 시 반드시 확인:

- [ ] Provider/ThemeProvider로 앱 루트 래핑
- [ ] CSS Reset/Normalize 적용
- [ ] 폰트 로딩 (CDN 또는 로컬)
- [ ] 한글 폰트 fallback 설정
- [ ] 다크모드 지원 여부 확인 및 적용
- [ ] 반응형 breakpoint 설정
- [ ] 접근성 (a11y) 기본 준수 (키보드 내비게이션, ARIA)
- [ ] 아이콘 세트 통일 (디자인 시스템 공식 아이콘 우선)

## 프레임워크별 참고

| 프레임워크 | 권장 접근 |
|-----------|----------|
| **React** | 공식 React 바인딩 우선 사용 |
| **Vue** | Vuetify(Material), PrimeVue, 또는 CSS-only 적용 |
| **Svelte** | CSS-only 또는 Svelte 래퍼 라이브러리 탐색 |
| **Vanilla** | CSS-only 버전 사용 (SLDS, Primer CSS, Carbon CSS) |
| **Next.js** | App Router: Provider를 client component로 분리 |
| **Tailwind 혼용** | 디자인 시스템 토큰을 Tailwind config에 매핑 |

## 후속 안내

디자인 시스템 적용 후:
1. 프로토타입 완성 시 사용자에게 스크린샷/미리보기 확인 요청
2. 토큰 커스터마이징이 필요하면 theme 설정 파일 분리 권장
3. Context7로 최신 API 변경사항 확인: `mcp__context7__query-docs`
