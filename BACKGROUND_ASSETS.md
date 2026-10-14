# 背景素材

本版主视觉采用用户提供的两张照片。另一张为新增的写实实验桌背景；未使用外部图片站素材。

| 项目内文件 | 用途 | 来源 |
| --- | --- | --- |
| `app/static/images/chalkboard-books.jpg` | 首页、帮助页 | 用户提供的黑板、书本、眼镜和铅笔照片 |
| `app/static/images/book-lightbulb.jpg` | 知识库页 | 用户提供的书本与灯泡照片 |
| `app/static/images/lab-desk.webp` | 分步页面标题背景 | 内置 imagegen 工具生成，写实教室实验桌；导出为 WebP |

照片通过 CSS 裁切和浅色 / 深色遮罩保证文字可读性，原素材内容没有重绘。

## 新增背景的完整提示

Use case: photorealistic-natural. Asset type: wide website background photograph for a Chinese university physics lab learning website. An authentic modest physics classroom workbench: warm worn oak desk, an open squared-paper notebook with subtle pencil sketches (no legible words), a simple analog meter, several small electrical components and neatly coiled leads on the far right, a softly blurred green chalkboard and pale plaster wall behind. Restrained old-school academic atmosphere, naturally imperfect materials, soft daylight from left, muted forest green and warm ivory, editorial photography with realistic texture and no glossy CGI. Landscape 16:9 framing. Leave the left two thirds quiet and softly out of focus for website headings. No people, no logos, no watermark, no added text, no collage or mockup.

## 使用方式

背景文件均随代码包保存，不依赖远程图片链接。新增背景用于装饰，不作为真实实验照片或测试证据。
