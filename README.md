# Claim System File Uploader Frontend

单页 React + TypeScript 应用，用于上传 X12/CSV 文件到数据管道系统。设计用于内部使用或受控环境，无需用户认证。

## 功能特性

- 📤 支持 X12 (.x12, .edi, .txt) 和 CSV (.csv) 文件上传
- 🔄 实时上传队列和状态跟踪
- 📊 上传进度显示
- 🔁 自动轮询后端状态
- ♻️ 失败重试功能
- ✅ 前端本地校验（文件大小、类型等）
- 🚫 无认证设计（适合内网环境）

## 技术栈

- React 18
- TypeScript
- Vite
- React Router

## 项目结构

```
src/
├── components/          # React 组件
│   ├── UploadForm.tsx   # 上传表单
│   └── UploadQueue.tsx  # 上传队列
├── pages/               # 页面组件
│   └── ClaimUploadPage.tsx
├── services/            # 业务逻辑
│   ├── api.ts           # API 调用
│   └── uploadManager.ts # 上传管理器
├── types/               # TypeScript 类型定义
│   └── index.ts
├── App.tsx
├── main.tsx
└── index.css
```

## 开发

### 安装依赖

```bash
npm install
```

### 开发服务器

```bash
npm run dev
```

访问 http://localhost:5173/claim-upload

### 构建

```bash
npm run build
```

构建产物在 `dist/` 目录，可部署到 S3 或其他静态托管服务。

## 配置

### API 基础 URL

通过环境变量配置后端 API 地址：

创建 `.env` 文件：

```env
VITE_API_BASE_URL=http://your-api-gateway-url
```

如果不设置，默认使用 `http://localhost:8000`

### S3 部署

构建后，将 `dist/` 目录内容上传到 S3 bucket。

如果部署在子路径（如 `/claim-upload/`），确保：
1. `vite.config.ts` 中的 `base` 配置正确
2. S3 bucket 配置正确的路径重写规则

## API 端点

前端调用以下后端 API（无需认证）：

- `POST /v1/uploads/presign` - 获取预签名 URL
- `GET /v1/uploads/{fileId}` - 查询上传状态

### Presign 请求示例

```json
{
  "file_name": "example.csv",
  "file_type": "CSV",
  "content_type": "text/csv",
  "approx_size_bytes": 1048576,
  "transaction_type": "837",
  "source_system": "Hospital_A",
  "business_date": "2025-11-25",
  "tags": {
    "batchName": "Nov-25 nightly job"
  }
}
```

## 文件限制

- **X12 文件**: 最大 200 MB
- **CSV 文件**: 最大 2 GB

## 上传流程

1. 用户选择文件并填写表单
2. 前端本地校验（大小、类型）
3. 调用 `POST /v1/uploads/presign` 获取上传 URL
4. 使用预签名 URL 直接上传到 S3
5. 上传成功后开始轮询后端状态
6. 轮询策略：
   - 前 60 秒：每 5 秒一次
   - 1-10 分钟：每 30 秒一次
   - 超过 10 分钟：停止轮询，提示查看历史页面

## 状态说明

- **READY** - 准备就绪，等待开始
- **REQUESTING_URL** - 正在请求预签名 URL
- **URL_READY** - 已获取上传 URL
- **UPLOADING** - 正在上传到 S3
- **UPLOADED** - S3 上传成功
- **PROCESSING** - 后端处理中
- **DONE** - 处理完成
- **FAILED** - 失败（可重试）

## 并发限制

前端最多同时上传 3 个文件，超出部分自动排队。

## 注意事项

⚠️ **无认证设计**：此应用设计用于内部或受控环境，所有 API 调用不包含认证 token。请确保：
- 网络环境受控（如医院内网）
- API Gateway 配置适当的访问控制（IP 白名单等）
- 不要在生产环境的公网暴露未认证的 API

刷新页面不会影响已成功上传到 S3 的文件，后台仍会继续处理。用户可在历史页面查看最终状态。

