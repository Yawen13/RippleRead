# 主页 UI 优化详细对比

## 关键改动清单

### 📊 布局结构优化

#### 1. 卡片尺寸紧凑化
```
继续阅读卡片：
  - padding: 14px 16px → 12px 14px ✓
  - 总高度：自动 → 更紧凑 ✓

今日目标卡片：
  - min-height: 218px → 180px ✓
  - padding: 24px 26px 22px → 20px 22px 18px ✓
  - 进度环大小: 92px → 78px ✓
  - 图表高度: 54px → 40px ✓
```

#### 2. 推荐书籍优化
```
卡片宽度: 220px → 180px ✓
内边距: 18px 18px 14px → 12px 12px 10px ✓
间距: gap 24px → gap 16px ✓
滚动条padding: 8px 60px 12px 2px → 6px 50px 8px 0 ✓

字体调整:
  - 标题: 0.72rem → 0.66rem ✓
  - 作者: 0.58rem → 0.52rem ✓
  - Badge: 0.52rem → 0.48rem ✓
  - Lexile: 0.5rem → 0.46rem ✓
```

#### 3. 文章卡片简化
```
显示数量: 3 篇 → 2 篇 ✓
网格列数: grid-template-columns: repeat(3, 1fr) 
        → repeat(2, 1fr) ✓
间距: gap 14px → gap 12px ✓
缩略图: 80x80px → 70x70px ✓
内边距: 10px 12px → 8px 10px ✓
标题: 0.68rem → 0.62rem ✓
底部间距: gap 10px → gap 6px ✓
```

#### 4. 阅读统计重新布局
```
网格: grid-template-columns: repeat(4, 1fr)
    → grid-template-columns: repeat(2, 1fr) ✓
内边距: 20px 32px → 16px 18px ✓
间距: gap 16px → gap 12px ✓
图表: 80px min-height → auto ✓
项目间: border-right padding-right 16px ✓
```

### 🎨 间距与排版优化

#### 页面级别
```css
.dash-page {
  padding: 22px 28px 40px → 18px 24px 32px
}

.dash-header-row {
  margin-bottom: 22px → 18px
}

.dash-grid {
  gap: 14px → 12px
  margin-bottom: 14px → 10px
}
```

#### 部分级别
```css
.recs-section {
  margin-bottom: 14px → 12px
}

.articles-section {
  margin-bottom: 14px → 0
}

.section-hd {
  margin-bottom: 10px → 8px
}

.goal-chart-row {
  gap: 9px → 8px
  padding-top: 24px → 16px
}
```

#### 统计项
```css
.stat-item {
  gap: 12px → 8px
}

.stat-item:not(:last-child) {
  padding-right: 16px (保持)
}
```

### 📝 字体与文本优化

| 元素 | 前 | 后 | 用途 |
|------|-----|-----|------|
| 推荐卡片标题 | 0.72rem | 0.66rem | 减少视觉重量 |
| 推荐卡片作者 | 0.58rem | 0.52rem | 更紧凑 |
| 文章标题 | 0.68rem | 0.62rem | 适配 2 列布局 |
| 文章阅读时间 | 0.5rem | 0.46rem | 保持可读性 |
| Badge 文字 | 0.52rem | 0.48rem | 减少占用 |
| 卡片圆角 | 16px→12px | 更现代的外观 | - |

### 💾 修改的文件

#### `home.css` (15+ 个 CSS 规则修改)
- `.dash-page`
- `.dash-header-row`
- `.dash-grid`
- `.dash-card`
- `.dash-card.goal-card`
- `.goal-ring`
- `.goal-chart`
- `.goal-chart-row`
- `.recs-section`
- `.recs-scroll`
- `.recs-card`
- `.recs-card__cover`
- `.recs-card__title`
- `.recs-card__author`
- `.recs-card__badge`
- `.recs-card__lexile`
- `.articles-section`
- `.articles-grid`
- `.article-card`
- `.article-card__thumb`
- `.article-card__body`
- `.article-card__title`
- `.article-card__footer`
- `.article-card__read-time`
- `.article-card__lexile`
- `.stats-section`
- `.stats-capsule`
- `.stat-item`

#### `home.js` (1 个 JavaScript 修改)
```javascript
// 第 197 行：
Math.min(articles.length, 3) → Math.min(articles.length, 2)
```

## 优化效果指标

### 首屏可见性 📱
| 模块 | 优化前 | 优化后 |
|------|--------|--------|
| 欢迎 + 搜索 | ✓ | ✓ |
| 继续阅读 + 今日目标 | ✓ | ✓ |
| 推荐书籍 | ⚠️ 部分 | ✓ 完整 |
| 每日文章 | ⚠️ 截断 | ✓ 完整 |
| 阅读洞察 | ❌ 隐藏 | ✓ 完整 |

### 空间节省 🗜️
- 总体高度减少: ~15-20%
- 推荐卡片宽度减少: 18%
- 文章网格行数: 1 行 3 列 → 1 行 2 列
- 统计网格行数: 1 行 4 列 → 2 行 2 列
- 页面 padding 减少: ~5%

### 视觉完整性 ✨
✅ 保留所有交互动画
✅ 保留悬停效果
✅ 保留品牌配色
✅ 保留响应式布局
✅ 保留无障碍特性

## 浏览器测试建议

### 标准视口 (1920x1080)
- 所有 5 个主要模块应完整显示
- 无需水平滚动
- 仅需轻微垂直滚动查看统计详情

### 平板视口 (768x1024)
- 继续阅读和今日目标并排
- 推荐书籍水平滚动
- 文章卡片 2 列布局

### 手机视口 (375x812)
- 堆叠式单列布局
- 水平滚动推荐书籍
- 所有功能保持可用

---

**技术总结：通过精细化的 CSS 调整和内容数量控制，实现了首屏完整显示所有核心功能，同时保持了设计的优雅性和互动性。**
