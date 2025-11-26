#!/bin/bash

# 部署脚本 - 将前端应用部署到 AWS S3
# 使用方法: ./deploy.sh <bucket-name> <api-gateway-url> [cloudfront-distribution-id]

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查参数
if [ $# -lt 2 ]; then
    echo -e "${RED}错误: 缺少必需参数${NC}"
    echo "使用方法: $0 <bucket-name> <api-gateway-url> [cloudfront-distribution-id]"
    echo ""
    echo "示例:"
    echo "  $0 my-bucket https://api.example.com"
    echo "  $0 my-bucket https://api.example.com E1234567890ABC"
    exit 1
fi

BUCKET_NAME=$1
API_URL=$2
CLOUDFRONT_ID=${3:-""}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}开始部署到 AWS S3${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "S3 Bucket: $BUCKET_NAME"
echo "API URL: $API_URL"
if [ -n "$CLOUDFRONT_ID" ]; then
    echo "CloudFront Distribution ID: $CLOUDFRONT_ID"
fi
echo ""

# 检查 AWS CLI 是否安装
if ! command -v aws &> /dev/null; then
    echo -e "${RED}错误: AWS CLI 未安装${NC}"
    echo "请先安装 AWS CLI: https://aws.amazon.com/cli/"
    exit 1
fi

# 检查 AWS 凭证
echo -e "${YELLOW}检查 AWS 凭证...${NC}"
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}错误: AWS 凭证未配置${NC}"
    echo "请运行: aws configure"
    exit 1
fi
echo -e "${GREEN}✓ AWS 凭证已配置${NC}"
echo ""

# 检查 Node.js 和 npm
echo -e "${YELLOW}检查 Node.js 环境...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: Node.js 未安装${NC}"
    exit 1
fi
if ! command -v npm &> /dev/null; then
    echo -e "${RED}错误: npm 未安装${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"
echo -e "${GREEN}✓ npm $(npm -v)${NC}"
echo ""

# 检查 bucket 是否存在
echo -e "${YELLOW}检查 S3 Bucket...${NC}"
if ! aws s3 ls "s3://$BUCKET_NAME" &> /dev/null; then
    echo -e "${YELLOW}警告: Bucket '$BUCKET_NAME' 不存在或无法访问${NC}"
    read -p "是否创建新 bucket? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "创建 bucket..."
        aws s3 mb "s3://$BUCKET_NAME"
        echo -e "${GREEN}✓ Bucket 创建成功${NC}"
    else
        echo -e "${RED}部署已取消${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Bucket 存在${NC}"
fi
echo ""

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}安装依赖...${NC}"
    npm install
    echo -e "${GREEN}✓ 依赖安装完成${NC}"
    echo ""
fi

# 构建项目
echo -e "${YELLOW}构建项目...${NC}"
echo "设置 API URL: $API_URL"
VITE_API_BASE_URL="$API_URL" npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}错误: 构建失败，dist 目录不存在${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 构建完成${NC}"
echo ""

# 上传到 S3
echo -e "${YELLOW}上传文件到 S3...${NC}"
DEPLOY_PATH="s3://$BUCKET_NAME/claim-upload/"
echo "目标路径: $DEPLOY_PATH"

aws s3 sync dist/ "$DEPLOY_PATH" --delete --exact-timestamps

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 文件上传成功${NC}"
else
    echo -e "${RED}错误: 文件上传失败${NC}"
    exit 1
fi
echo ""

# 设置 bucket 权限（如果需要）
echo -e "${YELLOW}检查 bucket 权限...${NC}"
echo "提示: 如果 bucket 需要公开访问，请手动配置 bucket 策略"
echo ""

# 清除 CloudFront 缓存（如果提供了 Distribution ID）
if [ -n "$CLOUDFRONT_ID" ]; then
    echo -e "${YELLOW}清除 CloudFront 缓存...${NC}"
    aws cloudfront create-invalidation \
        --distribution-id "$CLOUDFRONT_ID" \
        --paths "/*" \
        --output text > /dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ CloudFront 缓存清除请求已提交${NC}"
    else
        echo -e "${YELLOW}警告: CloudFront 缓存清除失败（可能不影响部署）${NC}"
    fi
    echo ""
fi

# 完成
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "访问地址:"
if [ -n "$CLOUDFRONT_ID" ]; then
    DIST_DOMAIN=$(aws cloudfront get-distribution --id "$CLOUDFRONT_ID" --query 'Distribution.DomainName' --output text 2>/dev/null || echo "")
    if [ -n "$DIST_DOMAIN" ]; then
        echo "  CloudFront: https://$DIST_DOMAIN/claim-upload/"
    fi
fi
echo "  S3 网站端点: http://$BUCKET_NAME.s3-website-<region>.amazonaws.com/claim-upload/"
echo ""
echo "下一步:"
echo "  1. 检查 S3 bucket 的静态网站托管配置"
echo "  2. 检查 bucket 权限策略"
echo "  3. 验证 API Gateway 的 CORS 配置"
echo "  4. 测试应用功能"
echo ""



