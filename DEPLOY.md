# 部署指南

本指南将帮助你将前端应用部署到 AWS S3（可选 CloudFront）。

## 🚀 快速开始

### 使用部署脚本（推荐）

```bash
# 1. 给脚本添加执行权限
chmod +x deploy.sh

# 2. 运行部署脚本
./deploy.sh <bucket-name> <api-gateway-url> [cloudfront-distribution-id]

# 示例
./deploy.sh my-claim-upload-bucket https://abc123.execute-api.us-east-1.amazonaws.com/prod
```

部署脚本会自动：
- ✅ 检查环境和依赖
- ✅ 构建项目（注入 API URL）
- ✅ 上传到 S3
- ✅ 清除 CloudFront 缓存（如果提供）

### 手动部署

如果你想手动控制每个步骤，请继续阅读下面的详细说明。

---

## 📋 详细部署步骤

### 1. 构建项目

**重要**: 构建时必须设置后端 API 的 URL！

```bash
# 设置 API URL 并构建
VITE_API_BASE_URL=https://your-api-gateway-url.com npm run build
```

构建产物在 `dist/` 目录。

### 2. 配置 S3 Bucket

#### 2.1 创建 S3 Bucket（如果还没有）

```bash
aws s3 mb s3://your-bucket-name --region us-east-1
```

#### 2.2 启用静态网站托管

在 AWS Console 中：
1. 进入 S3 bucket
2. 点击 "Properties" 标签
3. 滚动到 "Static website hosting"
4. 点击 "Edit"
5. 启用静态网站托管
6. 设置索引文档为 `index.html`
7. 设置错误文档为 `index.html`（用于 SPA 路由支持）
8. 保存

或者使用 AWS CLI：

```bash
aws s3 website s3://your-bucket-name/ \
  --index-document index.html \
  --error-document index.html
```

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

#### 4.1 API Gateway CORS 配置

后端 API Gateway 需要配置 CORS 头，允许前端域名访问：

```
Access-Control-Allow-Origin: https://your-frontend-domain.com
Access-Control-Allow-Methods: GET, POST, PUT
Access-Control-Allow-Headers: Content-Type
Access-Control-Allow-Credentials: false
```

**注意**: 如果前端和后端在同一域名下，可能不需要 CORS。

#### 4.2 S3 Bucket CORS 配置（用于文件上传）

如果文件直接上传到 S3，需要配置 bucket CORS。创建 `cors-config.json`:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "POST"],
    "AllowedOrigins": [
      "https://your-cloudfront-domain.com",
      "https://your-bucket-name.s3-website-us-east-1.amazonaws.com"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

应用配置：

```bash
aws s3api put-bucket-cors \
  --bucket your-bucket-name \
  --cors-configuration file://cors-config.json
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

#### 方式 1: 公开访问（仅用于测试）

如果 bucket 需要公开访问，创建 `bucket-policy.json`:

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

应用策略：

```bash
aws s3api put-bucket-policy \
  --bucket your-bucket-name \
  --policy file://bucket-policy.json
```

#### 方式 2: 通过 CloudFront 访问（推荐生产环境）

如果使用 CloudFront，bucket 可以保持私有，只允许 CloudFront 访问：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity YOUR_OAI_ID"
      },
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

### 使用部署脚本（推荐）

```bash
./deploy.sh <bucket-name> <api-gateway-url> [cloudfront-distribution-id]
```

### 手动更新

```bash
# 1. 重新构建（使用相同的 API URL）
VITE_API_BASE_URL=https://your-api-gateway-url.com npm run build

# 2. 同步到 S3
aws s3 sync dist/ s3://your-bucket-name/claim-upload/ --delete

# 3. 清除 CloudFront 缓存（如果使用）
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

## 📝 部署检查清单

详细的部署前检查清单请参考 [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)

## 🔍 验证部署

部署完成后，请验证：

1. **访问测试**: 在浏览器中打开部署的 URL
2. **功能测试**: 尝试上传一个小文件
3. **错误处理**: 检查网络错误提示是否正常
4. **API 连接**: 确认能成功调用后端 API

如果遇到问题，请参考检查清单中的"常见问题"部分。

