# PostgreSQL Runtime Bundle Layout

将 PostgreSQL 运行时文件放在该目录，打包时会复制到 `resources/postgres`。

目录结构要求：

- `resources/postgres/bin/pg_ctl`（Windows 为 `pg_ctl.exe`）
- `resources/postgres/data/`（首次启动初始化模板）

Desktop 主进程行为：

1. 启动时从 `resources/postgres/bin/pg_ctl` 拉起 PostgreSQL。
2. 首次启动会将 `resources/postgres/data/` 复制到用户持久化目录作为真实 data 目录。
3. 后续启动只使用用户目录下的 data，不再使用安装包内 data。

这样升级安装新版本时，不会覆盖用户已有数据库数据。
