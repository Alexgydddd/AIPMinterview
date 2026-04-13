
# AI 项目经理面试全流程辅助平台

> 你的专属智能「面试官」兼「简历毒舌教练」

---

## 核心功能

### 1. JD 深度分析

- 智能解析招聘信息，提取**公司、行业、核心产品**及**岗位所需技能与画像**。
- 生成**结构化能力要素列表**，清晰呈现「硬技能 / 软技能」及其在目标公司的具体应用场景（如：用加粗高亮关键词描述与 JD 的精准匹配）。

### 2. 毒舌简历诊断

- 上传简历后，AI 会对内容逐条**严格批判性点评**，从格式、内容到影响力三大维度逐一“吐槽”并打分。
- 支持分点展示每条改进项、**原文VS批评VS具体优化建议**，真正实现“有据可依”而不是空泛泛。

### 3. 智能结构化重写

- 一键结构化重写简历关键部分，确保所有输出为**严谨 JSON 格式**，字段明晰，内容全部用中文。
- 输出内容完全对齐 JD 要求，包括：一条核心竞争力概述、教育经历、每份工作经历（角色、项目名、难点、解决方案与最终结果）。

### 4. 面试导师人设陪练

- 内置“严肃但风趣”的AI面试官，自动基于每次对话历史和简历反馈，**步步引导、及时总结**。
- 支持围绕每条批评建议的**深度追问、反思与逐步优化**，交互过程更贴合真实面试场景。

---

## 运行与体验

1. **安装依赖**
   ```bash
   pnpm install
   ```
2. **本地开发启动**
   ```bash
   pnpm dev
   ```
3. **环境变量**

   **本地开发（`pnpm dev`）**  
   Vite 会把 `POST /api/proxy`、`POST /api/tts` 转到内置中间件。可在 `.env` / `.env.local` 中配置：
   - 大模型（文本）：`AI_API_KEY`、`AI_BASE_URL`（推荐），或开发兼容 `VITE_AI_*`
   - MiniMax 语音（`/api/tts`）：`MINIMAX_API_KEY`；若控制台要求再配 `MINIMAX_GROUP_ID`；可选 `MINIMAX_API_BASE`（默认 `https://api.minimax.io`）

   **部署到 Vercel（或其它运行 `api/proxy.ts` 的环境）**  
   在平台后台配置**仅服务端**变量（勿加 `VITE_` 前缀）：
   - `AI_API_KEY`（或 `OPENAI_API_KEY`）
   - `AI_BASE_URL`（或 `OPENAI_BASE_URL`，对接 DeepSeek 等兼容网关时填写对应 base URL）


   静态预览 `pnpm preview` **不包含** `/api/proxy` 与 `/api/tts`，需部署到 Vercel 或使用 `pnpm dev` / `vercel dev`。

4. **构建（可选）**
   ```bash
   pnpm build
   ```

---

## 部署到 Vercel

项目根目录已包含 **`vercel.json`**：`framework` 为 **Vite**，静态资源输出 **`dist`**，根目录 **`api/*.ts`** 会作为 Serverless Functions 部署（`POST /api/proxy`、`POST /api/tts`）。

1. 在 [Vercel](https://vercel.com) 新建项目，导入本仓库（或使用 CLI：`npx vercel`）。
2. **Build & Output**：一般无需改默认项；与 `vercel.json` 一致即可（`npm run build` → `dist`）。
3. **环境变量**（Project → Settings → Environment Variables），至少为 **Production**（建议 Preview 同步一份以便预览环境可用）：
   | 变量 | 说明 |
   |------|------|
   | `AI_API_KEY` 或 `OPENAI_API_KEY` | 大模型密钥（仅服务端，`/api/proxy`） |
   | `AI_BASE_URL` 或 `OPENAI_BASE_URL` | 可选；对接 DeepSeek 等时填写兼容网关 Base URL |
   | `MINIMAX_API_KEY` | MiniMax TTS（`/api/tts`）；可选 `MINIMAX_GROUP_ID`、`MINIMAX_API_BASE` |



本地联调全栈可使用：`npx vercel dev`（同时拉起 Vite 与 API，视 CLI 提示操作）。

---

## 技术亮点

- 基于 Vite + React，前后端接口零耦合。
- 支持多大模型厂商接入（DeepSeek/OpenAI 等）。
- 前端使用 TypeScript `类型驱动` 保证输入输出结构化。
- 智能提示和 JSON Schema 校验，确保大模型输出高一致性。

---

## 典型应用场景

- **求职者/PM** —— 快速洞察目标岗位用人“真需求”，精准补齐能力短板。
- **HR/招聘官** —— 批量诊断多人简历，辅助初筛、提升人才画像匹配度。
- **AI面试陪练** —— 针对简历亮点与不足，自动化生成专业面试“拷问”与针对性成长建议。

---

> 🚀 让 AI 成为你的下一个“简历导师”与“职业规划陪跑教练”！


