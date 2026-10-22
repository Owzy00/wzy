# 二十八宿海报化形 v33

在 v30 交互与 v32 青龙七宿基础上补齐二十一宿。原青龙七份点云文件逐字节保持，未改动 v30 边缘运动函数、星表、导航、手势识别或自动返回时长。每次仍是 96000 个主体目标与 48000 个流动点，JSON 和渲染缓存各最多两宿。

## 本次画报映射

| ID | 星宿 | 用户源文件 | 源文件 SHA-256 |
| --- | --- | --- | --- |
| 7 | 斗木獬 | Frame 153.png | e5e724b531bd296a36c5504c7bc9fcf59262a286d1f46f9890cb7cea9b73abb6 |
| 8 | 牛金牛 | Frame 157.png | a20bfb0a14c2df1302f8aab542f843b2efd4ae8af2e82385998079486e9971a4 |
| 9 | 女土蝠 | Frame 155.png | 1d98d7aa114854ce6dbe23e4f13cb24cac10c5068380419f8abf3962c8b5c969 |
| 10 | 虚日鼠 | Frame 159.png | ba6384ebf3abf0cf4dc5e089cf0dc93df8a38bc34581b1c348f46dcc9c5427a4 |
| 11 | 危月燕 | Frame 154.png | 2c049f5eed137ea5a7664277513242b8291446f1353b1d1f97e7dc68e3e92f0a |
| 12 | 室火猪 | Frame 158.png | 873b3bb8670f1977d04e18770aff6639f5a5a5d9326029322a857da947ee015a |
| 13 | 壁水貐 | Frame 156.png | e14f029cc9bf11eb55a1e4efd11fa660fa3f69246dff9757d4ccdf2d3908335e |
| 14 | 奎木狼 | Frame 169.png | 56ac5f4639db15cf4ac12259cef2fc8f3705b235434278b6ae64d03e843ba471 |
| 15 | 娄金狗 | Frame 173.png | d68edc69e0d46260b117ef7a3147cd127bbdbdfb9e51013fbd500d4572fcc718 |
| 16 | 胃土雉 | 03_胃土雉 1.png | d89550deb71cae2ae239f153bbe970680ed923465aa207ef8d8d66c29dfe5e5d |
| 17 | 昴日鸡 | 04_昴日鸡 1.png | b30740232572b33ac62dea8e1b5a1847277fed60507f3923b2fc7420ef524f24 |
| 18 | 毕月乌 | image 686.png | e2c3f6bc9fc3828be8c5688d9435338346ae9c69d0acd1b00ee8aeca75ce1a15 |
| 19 | 觜火猴 | image 687.png | 379852f9ba01aecfd3afc58afd1ffee1fd2efd5479835af5934f71dbc7f04f86 |
| 20 | 参水猿 | image 688.png | f2d3bc4c110cef87e6624196be9920081b01b3c919eb26f81037aac3931cf56a |
| 21 | 井木犴 | Frame 161.png | b708ffd253e1cb3292d7b36dca3587f8139eb9ab8aa644854b2c79c54a019cbf |
| 22 | 鬼金羊 | Frame 165.png | edaea393e34dceb306b30832170dcef1c02994655b867c9975f7733731b884c7 |
| 23 | 柳土獐 | Frame 163.png | c99d84a9929c70a27b7149d7029a471cac1b0dae516404fc988183a9042bc845 |
| 24 | 星日马 | Frame 167.png | f1c9b56e3bc521f5c4af0a292244bb8b013824e8b1290eba304ce805b7dbf8b7 |
| 25 | 张月鹿 | Frame 162.png | 729dd8385223602a2b3d6ff017172dd4fa0826116713d45f321d148931ad218f |
| 26 | 翼火蛇 | Frame 166.png | 9eb0a69077ca948a80f9681da0446bf6d743b0468ec6444aaf5510ded781055c |
| 27 | 轸水蚓 | Frame 164.png | 4c9ead121dbbc84d08485df245cfbb757beef9bb402ba12c545cd5dd41bdb66e |

奎木狼采用带有左侧当前星官标记的 Frame 169.png；image 678.png 为同一主体的另一版画报，不新增重复星宿。张月鹿采用 Frame 162.png；所附剪贴截图为同一主体。后补 Frame 173.png 对应娄金狗。称谓、宿序和拼音继续使用当前星宿目录的规范映射。

## 提取与效果

用逐张标定的主体轮廓排除标题、侧栏缩略图、说明文字和海报装饰星图，保留头冠、手持物与伴生兽。面部加强采样并禁止边缘逸出；外轮廓渐隐与真实表面边缘粒子共用 v30 的缓慢弯曲运动。每宿记录原图校验值、裁切和面部保护区域。图像深度仅用于轻视差，未使用 STL 或三维网格。

玄武保留紫蓝与暖金，白虎保留冰蓝，朱雀保留粉紫与橙金。主体 RGB 来自原画报，生成流与轨迹使用本组配色。原青龙仍走原有颜色分支；切回青龙会重置新配色开关。固定连线继续来自实际 HIP 星表，J2000 坐标不取海报中的装饰说明。摄像头框和两侧布局不变。

## 重现

运行 Python scripts/extract-other-posters.py --input-dir <画报目录>，需要 Pillow 和 NumPy；轮廓记录在 scripts/poster-outlines-v33.json。已有青龙采样脚本单独保留，不会被此脚本覆盖。随后运行 node scripts/package-other-posters.mjs，生成 gzip / base64 传输包。node scripts/restore-assets.mjs 校验并还原完整文件；npm test 和 npm run build 执行检查并生成离线单文件。

## 验证

137 项测试通过，包含全部二十八宿独立映射、二十一张源图 SHA-256、面部保护、边缘数据、144k 预算、缓存隔离、分组配色复位、原青龙文件一致、手势 / 鼠标、星象快照和自动返回。构建包含全部画报。实际浏览器已逐张检查本次二十一宿，均使用 WebGL 成形；另复核角木蛟和预览页直接切换。截图与记录在本地 outputs/posters-v33-previews。

主体验会自动返回星空。poster-layout-qa.html 是无需摄像头的固定成形预览，供切换对比。
