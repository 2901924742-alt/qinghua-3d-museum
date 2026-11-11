# 开源项目参考与本次取舍

核查日期：2026-10-11。针对现有 Three.js 青花瓷数字博物馆，保留原文字、瓷器模型、黑洞效果、移动端画质与全部交互。

| 项目 | 许可证与现状 | 适合参考的部分 | 本次判断 |
| --- | --- | --- | --- |
| [google/model-viewer](https://github.com/google/model-viewer) | Apache-2.0；非归档；[正式版本 v4.4.0](https://github.com/google/model-viewer/releases/tag/v4.4.0)，2026-10-09 UTC 发布 | GLB 加载流程、海报占位、标注、版本锁定与自行托管资源 | 成熟的模型展示组件；参考加载与依赖管理，暂不替换当前场景 |
| [donmccurdy/three-gltf-viewer](https://github.com/donmccurdy/three-gltf-viewer) | MIT；非归档；最近推送 2026-10-06 UTC | [模型居中、相机范围与 controls.saveState/reset](https://github.com/donmccurdy/three-gltf-viewer/blob/main/src/viewer.js)、资源清理 | 同技术栈，最适合借鉴可控的视角复位；该项目是独立查看器，不是完整博物馆 |
| [donmccurdy/glTF-Transform](https://github.com/donmccurdy/glTF-Transform) | MIT；非归档；最近推送 2026-10-06 UTC | GLB 资产分析、去重、压缩与转换流水线 | 适合未来展品增多时离线处理；现有瓷器清晰，不立即重压缩或缩小贴图 |
| [Smithsonian/dpo-voyager](https://github.com/Smithsonian/dpo-voyager) | Apache-2.0；非归档；最近推送 2026-10-02 UTC；README 明确仍为预发布 | [博物馆标注、文章、导览和轻量嵌入](https://smithsonian.github.io/dpo-voyager/document/overview/) | 博物馆设计最贴近；不能把它描述成稳定的即插即用底座，先参考导览组织方式 |

## 本次加入的改进

1. **依赖随站点托管**：沿用现有 three.js 0.160.0 的原文件，将 importmap 改为站内相对路径。所有必需模块及 MIT 许可证一并保存。参考 [model-viewer 加载文档](https://modelviewer.dev/examples/loading/)对依赖路径、版本和加载可靠性的处理。避免启动依赖外部 CDN，不引入新的框架或运行时。
2. **复位视角**：用现有 OrbitControls 保存初始相机、目标点和缩放状态，新增一个按钮供旋转、缩放或平移后返回。复位时结束旧触点并清除惯性，再恢复自动旋转；介绍框的显示状态保持由原有按钮和上滑手势控制。设计参考 three-gltf-viewer 的视角状态管理，用本项目原有 API 实现。

## 暂缓的内容

- 采用另一套查看器或完整博物馆框架：会重做当前场景、材质与交互，回归成本高。
- 动态降低瓷器画布分辨率、缩小贴图或有损重压缩：不符合保留手机端清晰度的要求。
- 常驻导览标注和多展品导航：可在有具体文物说明及新增展品后设计，避免当前手机画面增加遮挡。

MIT 与 Apache-2.0 均允许按各自许可证条件二次开发与再分发。采用实际代码时应保留许可证及要求的声明；模型、照片和文字等资产需要单独确认授权。本次只分发已使用的 Three.js 文件，未复制上述其他项目的代码或资产。


## R37 星河观景（本地候选）

黑洞追迹、时间积累、噪声与运镜依据用户提供的 blackhole-windows-dev-2026-11-11.zip 提取并适配。原文件 blackhole.html 的 SHA-256 为 507230420142b0b9ff28ff76edf5d5e891f20caebd4cfb30d1064f9399b8c338；没有引入其内嵌 Three.js r170 或独立渲染器。原始 ZIP 留存在 D 盘，完整性记录在本轮 work/blackhole-input-2026-11-11/input-integrity.json。该用户提供实现未被声明为另一个可自由再分发的开源许可证。

后处理复用 Three.js r160 官方 UnrealBloomPass、OutputPass、Pass 及三个着色器，按原样保存在 vendor/blackhole-postprocessing/，附 MIT LICENSE、固定提交及逐文件 SHA-256 的 source-manifest.json。仍使用展馆已有 Three.js r160、OrbitControls 和唯一的 WebGL canvas。

展馆远景使用同一追迹核心的蓝白配色离屏结果，近景保留原演示的艺术化表现。坠入采用无自旋史瓦西近似，界面说明其不是实测或精确的 Kerr 坠落模拟。弱能力设备可返回原展馆，远景不支持时使用原轻量兼容效果。未添加外部 CDN、账户服务或遥测。
