# Sub2API 打包发布指南

本文说明如何从当前仓库打包 Sub2API，并发布到服务器。推荐优先使用 Docker 镜像发布；如果服务器不使用 Docker，也可以发布单个后端二进制文件。

## 发布方式选择

| 方式 | 适用场景 | 产物 |
| --- | --- | --- |
| Docker 镜像发布 | 推荐；需要同时管理应用、PostgreSQL、Redis | `sub2api:<tag>` 镜像 |
| 二进制发布 | 已有 PostgreSQL、Redis、systemd 运维体系 | `sub2api` 可执行文件 |
| GoReleaser 发布 | 需要多平台归档包和镜像清单 | `dist/` 归档包、镜像 |

## 一、发布前检查

在打包前先确认工作区状态和版本号：

```bash
git status --short
cat backend/cmd/server/VERSION
```

建议至少执行前端类型检查和关键测试：

```bash
cd frontend
npm run typecheck
npm run lint:check
npx vitest run \
  src/views/auth/__tests__/LinuxDoCallbackView.spec.ts \
  src/views/auth/__tests__/WechatCallbackView.spec.ts \
  src/views/user/__tests__/PaymentView.spec.ts \
  src/views/user/__tests__/PaymentResultView.spec.ts \
  src/components/user/profile/__tests__/ProfileInfoCard.spec.ts \
  src/views/admin/__tests__/SettingsView.spec.ts
```

后端测试：

```bash
cd backend
go test ./...
```

注意：根目录 `make build` 适合开发构建，不是完整发布构建。发布二进制必须使用 `-tags embed`，否则后端不会内嵌前端页面。

## 二、Docker 镜像发布（推荐）

根目录 `Dockerfile` 已包含完整多阶段构建：

1. 使用 Node 构建前端。
2. 将前端产物复制到 `backend/internal/web/dist`。
3. 使用 Go 构建带 `embed` tag 的后端。
4. 生成最小运行镜像。

本地构建：

```bash
VERSION="$(tr -d '\r\n' < backend/cmd/server/VERSION)"
COMMIT="$(git rev-parse --short HEAD)"
DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

docker build \
  -t sub2api:${VERSION} \
  -t sub2api:latest \
  --build-arg VERSION="${VERSION}" \
  --build-arg COMMIT="${COMMIT}" \
  --build-arg DATE="${DATE}" \
  .
```

如果国内网络拉取 Go 依赖较慢，可以使用仓库默认代理参数，或显式指定：

```bash
docker build \
  -t sub2api:latest \
  --build-arg GOPROXY=https://goproxy.cn,direct \
  --build-arg GOSUMDB=sum.golang.google.cn \
  .
```

发布到镜像仓库：

```bash
docker tag sub2api:latest your-registry.example.com/sub2api/sub2api:latest
docker tag sub2api:latest your-registry.example.com/sub2api/sub2api:${VERSION}
docker push your-registry.example.com/sub2api/sub2api:latest
docker push your-registry.example.com/sub2api/sub2api:${VERSION}
```

服务器部署建议使用 `deploy/docker-compose.local.yml`，它把数据落到本地目录，方便迁移：

```bash
mkdir -p /opt/sub2api
cd /opt/sub2api

cp /path/to/repo/deploy/docker-compose.local.yml ./docker-compose.yml
mkdir -p data postgres_data redis_data
```

创建 `.env`：

```bash
cat > .env <<'EOF'
SERVER_PORT=8080
SERVER_MODE=release
RUN_MODE=standard
TZ=Asia/Shanghai

POSTGRES_USER=sub2api
POSTGRES_PASSWORD=请替换为强密码
POSTGRES_DB=sub2api

REDIS_PASSWORD=请替换为强密码
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=请替换为管理员初始密码

JWT_SECRET=请使用_openssl_rand_hex_32_生成
TOTP_ENCRYPTION_KEY=请使用_openssl_rand_hex_32_生成
EOF
```

生成密钥：

```bash
openssl rand -hex 32
```

编辑 `docker-compose.yml`，将应用镜像改为你的镜像地址：

```yaml
services:
  sub2api:
    image: your-registry.example.com/sub2api/sub2api:latest
```

启动：

```bash
docker compose up -d
docker compose logs -f sub2api
```

健康检查：

```bash
curl -f http://127.0.0.1:8080/health
```

升级：

```bash
cd /opt/sub2api
docker compose pull
docker compose up -d
docker compose logs -f sub2api
```

回滚：

```bash
cd /opt/sub2api
# 将 docker-compose.yml 中 image 改回上一个 tag
docker compose up -d
docker compose logs -f sub2api
```

## 三、二进制打包发布

二进制发布适合已有 PostgreSQL 和 Redis 的服务器。

本地构建前置要求：

- Go 版本与 `backend/go.mod` 一致或更高。
- Node.js 与 npm 可用。
- 已安装前端依赖。

构建前端：

```bash
cd frontend
npm ci
npm run build
```

前端产物会输出到：

```text
backend/internal/web/dist
```

构建后端二进制有两种情况：

- 在 Linux amd64 服务器上构建：可以不写 `GOOS/GOARCH`。
- 在 macOS 或其他系统上给 Linux 服务器打包：必须显式设置 `GOOS=linux GOARCH=amd64`。

推荐统一使用下面的 Linux amd64 交叉编译命令，产物固定输出到 `backend/bin/sub2api`，适合本地打包后手动上传服务器。

```bash
cd /path/to/sub2api

cd backend
VERSION="$(tr -d '\r\n' < cmd/server/VERSION)"
COMMIT="$(git rev-parse --short HEAD)"
DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
mkdir -p ./bin

CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
  -tags embed \
  -ldflags "-s -w -X main.Version=${VERSION} -X main.Commit=${COMMIT} -X main.Date=${DATE} -X main.BuildType=release" \
  -trimpath \
  -o ./bin/sub2api \
  ./cmd/server
```

执行完成后会得到：

```text
backend/bin/sub2api
```

这一步只生成 Linux amd64 二进制文件，不会自动生成 `sub2api-${VERSION}-linux-amd64.tar.gz`。如果你是手动上传服务器，直接上传 `backend/bin/sub2api` 即可。

如果确实需要压缩包，再从仓库根目录额外执行：

```bash
cd /path/to/sub2api
VERSION="$(tr -d '\r\n' < backend/cmd/server/VERSION)"
mkdir -p release-build/sub2api-linux-amd64
cp backend/bin/sub2api release-build/sub2api-linux-amd64/sub2api
cp deploy/config.example.yaml release-build/sub2api-linux-amd64/config.yaml
cp -R backend/resources release-build/sub2api-linux-amd64/resources
tar czf sub2api-${VERSION}-linux-amd64.tar.gz -C release-build sub2api-linux-amd64
```

打包完成后，压缩包位于仓库根目录：

```text
sub2api-${VERSION}-linux-amd64.tar.gz
```

如果目标服务器是 ARM64，例如部分 ARM 云主机，把上面的 `GOARCH=amd64` 改成 `GOARCH=arm64`，目录名和压缩包名也相应改成 `linux-arm64`。

手动上传到服务器时，建议不要直接覆盖正在运行的旧文件，先上传为临时文件：

```bash
scp backend/bin/sub2api user@server:/opt/sub2api/sub2api.new
```

服务器替换时先停止旧进程，再替换文件：

```bash
cd /opt/sub2api
# 先停止旧进程，例如 kill "$(cat sub2api.pid)"，或用你自己的进程管理方式停止
mv sub2api sub2api.old
mv sub2api.new sub2api
chmod +x sub2api
```

编辑 `config.yaml`，至少确认：

```yaml
server:
  host: "0.0.0.0"
  port: 8080
  mode: "release"

database:
  host: "127.0.0.1"
  port: 5432
  user: "sub2api"
  password: "请替换"
  dbname: "sub2api"
  sslmode: "disable"

redis:
  host: "127.0.0.1"
  port: 6379
  password: "请替换"
```

程序会按以下顺序查找 `config.yaml`：

1. `DATA_DIR` 环境变量指向的目录。
2. `/app/data`。
3. 当前工作目录。
4. 当前工作目录下的 `config/`。
5. `/etc/sub2api`。

前台启动验证：

```bash
./sub2api
```

健康检查：

```bash
curl -f http://127.0.0.1:8080/health
```

## 四、systemd 服务示例

创建 `/etc/systemd/system/sub2api.service`：

```ini
[Unit]
Description=Sub2API
After=network.target postgresql.service redis.service

[Service]
Type=simple
WorkingDirectory=/opt/sub2api
ExecStart=/opt/sub2api/sub2api
Restart=always
RestartSec=5
User=sub2api
Group=sub2api
LimitNOFILE=100000
Environment=TZ=Asia/Shanghai

[Install]
WantedBy=multi-user.target
```

创建用户并启动：

```bash
sudo useradd --system --home /opt/sub2api --shell /usr/sbin/nologin sub2api
sudo chown -R sub2api:sub2api /opt/sub2api
sudo systemctl daemon-reload
sudo systemctl enable sub2api
sudo systemctl start sub2api
sudo journalctl -u sub2api -f
```

## 五、GoReleaser 发布

仓库已有 `.goreleaser.yaml`，用于多平台归档和镜像发布。使用前先构建前端，因为 GoReleaser 的构建也依赖 `-tags embed`：

```bash
cd frontend
npm ci
npm run build
cd ..
```

本地试运行：

```bash
goreleaser release --snapshot --clean
```

正式发布通常由 CI 在 tag 上执行。手工执行前需要确认 Docker Hub、GHCR 等环境变量和登录状态已经配置好。

## 六、Nginx 反向代理要点

如果通过 Nginx 对外提供服务，建议至少包含：

```nginx
server {
    listen 80;
    server_name example.com;

    client_max_body_size 256m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

如果要兼容 Codex CLI 或其他带下划线请求头的客户端，需要在 Nginx `http` 块开启：

```nginx
underscores_in_headers on;
```

## 七、发布后检查清单

发布后逐项检查：

- `curl -f http://127.0.0.1:8080/health` 返回成功。
- 浏览器能打开管理后台。
- 管理员账号能登录。
- PostgreSQL 和 Redis 数据目录已持久化。
- `JWT_SECRET` 和 `TOTP_ENCRYPTION_KEY` 是固定值，不会随重启变化。
- 支付、OAuth、邮件、代理等外部配置已按生产环境填写。
- Nginx 或 CDN 没有拦截 `/api/`、SSE、WebSocket 或回调地址。
- 日志中没有数据库迁移、Redis 连接、配置读取错误。

## 八、常见问题

### 页面打不开或只有接口可用

通常是后端没有嵌入前端。重新确认构建命令包含：

```bash
go build -tags embed ...
```

并且前端已经先执行：

```bash
cd frontend
npm run build
```

### Docker 启动后登录态频繁失效

检查 `.env` 中是否设置了固定的 `JWT_SECRET`。为空时可能在重启后生成新值，导致旧 token 失效。

### 2FA 重启后不可用

检查 `.env` 中是否设置了固定的 `TOTP_ENCRYPTION_KEY`。为空时可能导致已有 TOTP 配置无法解密。

### 支付回调不生效

确认支付平台配置的回调地址能被公网访问，且 Nginx/CDN 没有拦截 POST 请求。回调地址示例：

```text
https://你的域名/api/v1/payment/webhook/alipay
```
