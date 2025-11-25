# 部署指南

## S3 静态托管部署

### 1. 构建项目

```bash
npm run build
```

构建产物在 `dist/` 目录。

### 2. 配置 S3 Bucket

1. 创建 S3 bucket（或使用现有 bucket）
2. 启用静态网站托管
3. 设置索引文档为 `index.html`
4. 配置错误文档（可选）：`index.html`（用于 SPA 路由）

### 3. 配置路由重写（如果部署在子路径）

如果部署在子路径（如 `/claim-upload/`），需要配置 CloudFront 或 API Gateway：

#### CloudFront 配置

创建 CloudFront Distribution，添加错误页面规则：
- HTTP 错误码: 403, 404
- 响应页面路径: `/claim-upload/index.html`
- HTTP 响应码: 200

或者使用 Lambda@Edge 函数重写路径。

#### S3 直接托管（根路径）

如果部署在 bucket 根路径，直接在 bucket 根目录上传 `dist/` 内容。

### 4. CORS 配置

如果前端需要从不同域名调用 API，确保后端 API 配置了正确的 CORS 头：

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT
Access-Control-Allow-Headers: Content-Type
```

### 5. 环境变量配置

在生产环境中，前端需要知道后端 API 的 URL。有几种方式：

#### 方式 1: 构建时注入（推荐）

在构建时设置环境变量：

```bash
VITE_API_BASE_URL=https://your-api-gateway-url.com npm run build
```

#### 方式 2: 运行时配置

创建一个配置文件 `public/config.json`：

```json
{
  "apiBaseUrl": "https://your-api-gateway-url.com"
}
```

然后在代码中动态加载（需要修改代码）。

### 6. 上传文件到 S3

使用 AWS CLI 上传：

```bash
aws s3 sync dist/ s3://your-bucket-name/claim-upload/ --delete
```

或者使用 AWS Console 手动上传。

### 7. 设置权限

确保 S3 bucket 有正确的读取权限：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

## CloudFront 加速（可选）

为了更好的性能和 HTTPS，可以配置 CloudFront：

1. 创建 CloudFront Distribution
2. Origin 指向 S3 bucket
3. 配置 SSL 证书（使用 AWS Certificate Manager）
4. 设置缓存策略（对于 `index.html` 使用无缓存）

## 更新部署

更新时只需重新构建并同步到 S3：

```bash
npm run build
aws s3 sync dist/ s3://your-bucket-name/claim-upload/ --delete
```

清除 CloudFront 缓存（如果使用）：

```bash
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

