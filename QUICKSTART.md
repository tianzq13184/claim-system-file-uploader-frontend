# 快速开始

## 1. 安装依赖

```bash
npm install
```

## 2. 配置环境变量（可选）

创建 `.env` 文件：

```env
VITE_API_BASE_URL=http://localhost:8000
```

如果不配置，默认使用 `http://localhost:8000`。

## 3. 启动开发服务器

```bash
npm run dev
```

浏览器访问：http://localhost:5173/claim-upload

## 4. 测试上传流程

1. **选择文件**
   - 支持 X12 (.x12, .edi, .txt) 或 CSV (.csv)
   - 文件大小限制：X12 最大 200MB，CSV 最大 2GB

2. **填写表单**
   - File Type: 会根据文件扩展名自动推断，可手动修改
   - Source System: 选择医院（Hospital_A, Hospital_B, Hospital_C）
   - Transaction Type: 选择交易类型（834, 835, 837）
   - Business Date: 选择业务日期（默认今天）
   - Batch Name: 可选，用于标记批次

3. **开始上传**
   - 点击 "Start Upload" 按钮
   - 系统会自动：
     - 请求预签名 URL
     - 上传文件到 S3
     - 轮询后端状态

4. **查看状态**
   - 在上传队列中查看所有文件的状态
   - 支持重试失败的上传
   - 完成后可查看详细信息

## 5. 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录，可部署到 S3。

## 注意事项

⚠️ 这是一个无认证版本，设计用于内部或受控环境。确保：
- API 端点配置正确
- 网络环境安全（如内网）
- 不要在生产环境的公网暴露未认证的 API

