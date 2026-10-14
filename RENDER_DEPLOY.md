# Render 免费部署与持久数据库

网站使用 Render Free Web Service（Docker），数据使用 Turso Free 的 libSQL 数据库。Render 本地文件会在休眠、重启和部署后丢失，因此云端直接访问 Turso，不把数据库当作本地缓存同步。

## 连接已有服务

1. 将当前代码提交到 GitHub 仓库的 `main`。
2. 在 Turso 创建 libSQL 数据库，并为这个数据库创建读写令牌。
3. 打开 Render 服务的 Environment，设置：

| 环境变量 | 值 |
| --- | --- |
| `ENABLE_LLM` | `false` |
| `REQUIRE_PERSISTENT_DATABASE` | `true` |
| `TURSO_DATABASE_URL` | Turso 提供的 `libsql://…` 数据库地址 |
| `TURSO_AUTH_TOKEN` | 仅在 Render 后台保存的数据库令牌 |

4. 保存并部署。服务使用仓库里的 Dockerfile，无需付费磁盘；健康检查路径为 `/api/v1/health`。
5. 注册测试账号、建立班级、提交作业，再重启应用并重新登录，核对记录仍在。

`render.yaml` 提供新建服务的同等配置，所有资源都明确使用 Free。已有服务无需重复创建。

## 记录与密钥

- 缺少云数据库连接配置且开启 `REQUIRE_PERSISTENT_DATABASE` 时，应用拒绝启动，避免悄悄改用临时数据库。
- 账号、班级、作业、诊断和修改记录写入同一个云数据库。
- 密钥保存在 Render 环境变量中。不要上传真实 `.env`、数据库备份或令牌到 GitHub。
- 本机 SQLite 保持可用；不配置 Turso 时继续使用 `DATABASE_PATH`。连接云数据库不会自动上传本机既有记录。
- 备份可在 Turso 数据库页面选择 Download SQLite File，并存放在私有位置。

## 免费限制

Render 免费服务空闲约 15 分钟后休眠，首次访问需要等待重新启动；网站公开地址不依赖个人电脑。Turso 免费计划有存储和读写配额。保持免费套餐，不启用付费升级或超额计费。

官方说明：[Render Free](https://render.com/docs/free)、[Turso Pricing](https://turso.tech/pricing)、[Turso Python](https://docs.turso.tech/sdk/python/quickstart)。
