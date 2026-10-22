# 青龙七宿海报化形 v32

在恢复的 v30 基础上扩展六宿。角木蛟原始点云、颜色、边缘数据和 v30 动效函数不变；其他二十一宿保持原有摄影点云。未引入 STL、网格或 v31 修改。

| 宿 ID | 彩塑 | 用户画报 | 新点云 |
| --- | --- | --- | --- |
| 1 | 亢金龙 | Frame 146.png | dist/data/qinglong/01-kang.json |
| 2 | 氐土貉 | Frame 147.png | dist/data/qinglong/02-di.json |
| 3 | 房日兔 | Frame 148.png | dist/data/qinglong/03-fang.json |
| 4 | 心月狐 | Frame 149.png | dist/data/qinglong/04-xin.json |
| 5 | 尾火虎 | Frame 151.png | dist/data/qinglong/05-wei.json |
| 6 | 箕水豹 | Frame 150.png | dist/data/qinglong/06-ji.json |

用户同时提供的 Frame 145.png 对应角木蛟；按本次“修改其他的”要求，继续使用已接受的原 v30 角木蛟素材，不重新采样。

每宿在对应原图上标定主体轮廓，排除标题、说明、缩略图和海报星图装饰。96000 个表面样本保留原图颜色，面部加强采样并禁止边缘逸出。轮廓由表面透明度渐变与约 6600–7800 个真实边缘样本连续飘散，另有 36000 个表面支持粒子，沿用 v30 弯曲慢流。每次总预算 144000 点。图像轻深度仅用于原有视差，不宣称三维重建。

重新提取：
```sh
python scripts/extract-qinglong-posters.py --input-dir <六张画报目录>
node scripts/package-qinglong-posters.mjs
node scripts/restore-assets.mjs
npm test
npm run build
```

Python 提取依赖 Pillow、NumPy。每个派生资产记录源文件 SHA-256、裁切、保护区域和编码。部署采用 gzip / base64，恢复时验证完整文件 SHA-256。

界面使用对应宿的实际 HIP 星点连线与 J2000 坐标。星象、文字、摄像头小框继续固定；生成及展示保留五指独立涟漪和鼠标交互。JSON 和渲染缓存各最多两宿，同一加载请求复用；切回摄影点云清除海报发射属性。

验证：112 项测试通过，包括六宿及源图映射、缓存、面部保护、边缘数据、144k 预算、加载失败重试、原角木蛟文件校验、手势、鼠标、自动返回和星象连线。构建检查离线文件嵌入全部七宿海报。六宿已在实际浏览器逐张核对。预览页无需摄像头：poster-layout-qa.html?v=32&mansion=1（可选 1–6）。

原 v30 角木蛟完整资产 SHA-256：
52a71b6e6cd62854392067c9695c11ea3343954f6d0ecb1715a6fe8d64acfb8e

原 28 宿摄影点云 SHA-256：
70e0f1ef689c9508552c06d14673e3d8079c5b1660755607bc720a5c62220966
