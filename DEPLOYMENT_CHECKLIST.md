# 部署检查清单

在部署到 AWS 之前，请按照以下清单逐项检查：

## 📋 部署前检查

### 1. 环境准备
- [ ] Node.js 和 npm 已安装
- [ ] AWS CLI 已安装并配置 (`aws configure`)
- [ ] AWS 凭证有足够的权限（S3、CloudFront 等）
- [ ] 项目依赖已安装 (`npm install`)

### 2. 配置信息
- [ ] 已获取后端 API Gateway URL
- [ ] 已确定 S3 bucket 名称
- [ ] 已确定部署路径（如 `/claim-upload/`）
- [ ] 如果使用 CloudFront，已获取 Distribution ID

### 3. AWS 资源准备
- [ ] S3 bucket 已创建（或计划创建）
- [ ] S3 bucket 已启用静态网站托管
- [ ] S3 bucket 索引文档设置为 `index.html`
- [ ] S3 bucket 错误文档设置为 `index.html`（用于 SPA 路由）
- [ ] S3 bucket 权限策略已配置（公开读取或通过 CloudFront 访问）

### 4. 后端 API 配置
- [ ] API Gateway 已配置 CORS 头
- [ ] API Gateway 允许来自前端域名的请求
- [ ] 测试 API 端点可访问

### 5. S3 CORS 配置（用于文件上传）
如果文件直接上传到 S3，需要配置 bucket CORS：

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "POST"],
    "AllowedOrigins": [
      "https://your-cloudfront-domain.com",
      "http://your-s3-website-endpoint.com"
    ],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3000
  }
]
```

## 🚀 部署步骤

### 方式 1: 使用部署脚本（推荐）

```bash
# 1. 给脚本添加执行权限
chmod +x deploy.sh

# 2. 运行部署脚本
./deploy.sh <bucket-name> <api-gateway-url> [cloudfront-distribution-id]

# 示例
./deploy.sh my-claim-upload-bucket https://abc123.execute-api.us-east-1.amazonaws.com/prod
```

### 方式 2: 手动部署

```bash
# 1. 构建项目（设置 API URL）
VITE_API_BASE_URL=https://your-api-gateway-url.com npm run build

# 2. 上传到 S3
aws s3 sync dist/ s3://your-bucket-name/claim-upload/ --delete

# 3. 清除 CloudFront 缓存（如果使用）
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

## ✅ 部署后验证

### 1. 访问测试
- [ ] 在浏览器中访问部署的 URL
- [ ] 检查页面是否正常加载
- [ ] 检查开发信息（开发环境）显示的 API URL 是否正确

### 2. 功能测试
- [ ] 上传一个小文件测试完整流程
- [ ] 检查是否能成功获取预签名 URL
- [ ] 检查文件是否能成功上传到 S3
- [ ] 检查状态轮询是否正常工作
- [ ] 检查错误处理是否正常（如断开网络）

### 3. 网络问题排查
如果遇到问题，检查：

- [ ] **CORS 错误**: 检查 API Gateway 和 S3 bucket 的 CORS 配置
- [ ] **连接失败**: 检查 API Gateway URL 是否正确
- [ ] **404 错误**: 检查 S3 bucket 路径和 CloudFront 配置
- [ ] **权限错误**: 检查 S3 bucket 权限策略

### 4. 性能检查
- [ ] 页面加载速度正常
- [ ] 文件上传进度显示正常
- [ ] 大文件上传测试（接近限制大小）

## 🔧 常见问题

### 问题 1: CORS 错误
**症状**: 浏览器控制台显示 CORS 相关错误

**解决方案**:
1. 检查 API Gateway 的 CORS 配置
2. 检查 S3 bucket 的 CORS 配置（如果直接上传到 S3）
3. 确保 `Access-Control-Allow-Origin` 包含前端域名

### 问题 2: 404 错误（刷新页面后）
**症状**: 直接访问子路由或刷新页面后出现 404

**解决方案**:
1. 如果使用 CloudFront，配置错误页面重定向到 `index.html`
2. 如果直接使用 S3，确保错误文档设置为 `index.html`

### 问题 3: API 调用失败
**症状**: 无法获取预签名 URL 或查询状态

**解决方案**:
1. 检查构建时设置的 `VITE_API_BASE_URL` 是否正确
2. 检查 API Gateway 是否可访问
3. 检查网络连接和防火墙设置

### 问题 4: 文件上传失败
**症状**: 文件无法上传到 S3

**解决方案**:
1. 检查 S3 bucket 的 CORS 配置
2. 检查预签名 URL 是否有效
3. 检查文件大小是否超过限制

## 📝 更新部署

当需要更新应用时：

```bash
# 1. 重新构建（使用相同的 API URL）
VITE_API_BASE_URL=https://your-api-gateway-url.com npm run build

# 2. 同步到 S3
aws s3 sync dist/ s3://your-bucket-name/claim-upload/ --delete

# 3. 清除 CloudFront 缓存
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

或者直接使用部署脚本：

```bash
./deploy.sh <bucket-name> <api-gateway-url> [cloudfront-distribution-id]
```

## 🔒 安全建议

1. **不要在生产环境暴露未认证的 API**
   - 使用 IP 白名单
   - 使用 VPC 端点
   - 使用 API Gateway 的 API Key 或 Cognito

2. **限制 S3 bucket 访问**
   - 不要公开整个 bucket
   - 只允许通过 CloudFront 访问
   - 使用 bucket 策略限制访问来源

3. **使用 HTTPS**
   - 通过 CloudFront 提供 HTTPS
   - 使用 AWS Certificate Manager (ACM) 管理证书

4. **监控和日志**
   - 启用 CloudFront 访问日志
   - 监控 API Gateway 的调用情况
   - 设置 CloudWatch 告警



