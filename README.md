# 星野 · 手势与彩塑 v7

黑底二十八宿星图，叠加独立的 MediaPipe 手势输入与 28 宿彩塑 2.5D 粒子化形。彩塑使用用户提供并确认有使用权限的四张摄影拼图；未引入参考项目的程序或神像插画。

v7 移除了开场的环状粒子团，改为侧向流入的暖金粒子云片，渐渐汇入彩塑。WebGL 使用静态点缓冲与顶点着色器，最多 48,000 彩塑点加 96,000 流线点，每帧一次绘制；没有逐点 CPU 更新或逐帧上传点云。黑场覆盖星图时跳过其重绘，退出时恢复。不支持 WebGL 时自动使用预绘粒子缓存，保留化形、持续观赏和返回操作。

## 开始体验

推荐解压完整包，双击 `启动星野.bat`，然后用 Chrome / Edge 打开 http://127.0.0.1:4173/。保持终端运行，关闭即停止服务。需要 Node.js 20+，无需 npm install；MediaPipe、Wasm 和模型已包含在包内。

单文件体验版为 `星野-手势与彩塑-v7.html`：内嵌星表、样式、程序和全部点云，键鼠与按钮化形可离线使用。单文件开启摄像头时依赖外部网络资源，摄像头建议在完整包的 localhost 页面使用。

## 主要操作

- 拖动、滚轮、方向键、加减号：浏览星图；V 切换投影，R 重置，1–4 四象，[ / ] 上下宿，F 聚焦。
- W / “推动星尘”按钮 / Shift + 拖动：推动独立装饰粒子。
- M / “粒子化形”：从已选宿汇聚成对应彩塑。
- “持续观赏”：暂停自动回归；Esc / “回到星图”：平滑结束。
- “手势交互”→“开启摄像头”：单手张掌稳定后挥动；仅伸食指，稳定后画完整一圈。

视频仅在本机工作线程处理，不上传、不录制。关闭手势面板、关闭摄像头或切入后台会释放摄像头。

## 开发与验证

```sh
npm run dev
npm test
npm run build
```

静态发布目录为 `dist/`。构建会生成单文件并检查脚本、数据映射、点云和模型资源。`qa.html` 可运行不申请摄像头的真实模型自检。

MediaPipe：`@mediapipe/tasks-vision` 1.1.1，CPU Worker。模型与依赖来源 / 校验值见 `dist/vendor/mediapipe/provenance.json`。近似深度属于艺术演绎，不是实测三维重建。原始拼图分辨率决定面部和衣纹细节上限。

天文坐标、连线和装饰粒子相互隔离；星表对象冻结。数据来源和许可见 `dist/data/provenance.json`、`dist/data/NOTICE.txt`。彩塑来源、裁切框、原图 SHA-256 与宿名映射见 `dist/data/statues.json`；原图切片位于 `dist/assets/statues/`。

实现、误触防护及使用边界见 [PHASES-2-3.md](PHASES-2-3.md)，测试记录见 [TESTING.md](TESTING.md)，配色历史见 [THEME.md](THEME.md)。真实摄像头识别率、不同手型 / 光照和低端设备性能仍需实机验收。

重新提取点云需安装 Python 的 Pillow 与 NumPy，并运行 `python scripts/extract-statues.py --input-dir <原始四张拼图目录>`。原始文件名对应记录保留在脚本中，生成结果覆盖 dist/data/statues.json。依赖重新下载脚本为 scripts/download-mediapipe.py，固定版本和模型来源。
